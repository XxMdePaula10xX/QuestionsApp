/**
 * Cloud Functions — Sabido.
 *
 * Anti-cheat server-side da revisão:
 *  - B1: o GABARITO é resolvido aqui, lido do Storage (não vai ao device em
 *        modos competitivos). A Function é a fonte única da verdade.
 *  - B3: pontuação IDEMPOTENTE (sessionId + flag `scored`) em transação com
 *        FieldValue.increment (evita double-credit e write contention).
 *  - Rankings (global/por-modo/semanal) escritos só aqui.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 })

type Difficulty = 'facil' | 'medio' | 'dificil'
type GameMode = 'normal' | 'stop' | 'challenge'
const POINTS: Record<Difficulty, number> = { facil: 100, medio: 200, dificil: 300 }

interface SubmitScorePayload {
  sessionId: string
  mode: GameMode
  answers: number[]
  questionIds: string[]
}

interface KeyEntry {
  index: number
  difficulty: Difficulty
}

// Índice id->gabarito, cacheado entre invocações quentes.
let answerKeyCache: Map<string, KeyEntry> | null = null

async function loadAnswerKey(): Promise<Map<string, KeyEntry>> {
  if (answerKeyCache) return answerKeyCache
  const bucket = getStorage().bucket()
  const [manifestBuf] = await bucket.file('questions/manifest.json').download()
  const manifest = JSON.parse(manifestBuf.toString()) as {
    categories: { file: string }[]
  }
  const map = new Map<string, KeyEntry>()
  for (const cat of manifest.categories) {
    const [buf] = await bucket.file(`questions/${cat.file}`).download()
    const file = JSON.parse(buf.toString()) as {
      questions: { id: string; answerIndex: number; difficulty: Difficulty }[]
    }
    for (const q of file.questions) map.set(q.id, { index: q.answerIndex, difficulty: q.difficulty })
  }
  answerKeyCache = map
  return map
}

/** weekId ISO `YYYY-Www` — idêntico ao cliente (src/lib/weekId.ts). */
function weekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export const submitScore = onCall<SubmitScorePayload>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário')

  const { sessionId, mode, answers, questionIds } = request.data
  if (!sessionId || !Array.isArray(answers) || !Array.isArray(questionIds)) {
    throw new HttpsError('invalid-argument', 'Payload inválido')
  }
  if (!['normal', 'stop', 'challenge'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'Modo inválido')
  }

  // Resolve o gabarito ANTES da transação (Storage não entra na tx).
  const key = await loadAnswerKey()
  let correct = 0
  let score = 0
  questionIds.forEach((qid, i) => {
    const k = key.get(qid)
    if (k && answers[i] === k.index) {
      correct++
      score += POINTS[k.difficulty]
    }
  })

  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId)
  const userRef = db.collection('users').doc(uid)
  const wId = weekId()

  return db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef)
    if (sessionSnap.exists && sessionSnap.get('scored') === true) {
      return { alreadyScored: true, score: sessionSnap.get('score') ?? 0, correct: sessionSnap.get('correct') ?? 0 }
    }
    const userSnap = await tx.get(userRef)
    const displayName = (userSnap.get('displayName') as string) ?? 'Jogador'
    const photoURL = (userSnap.get('photoURL') as string | null) ?? null

    // Crédito atômico no perfil.
    tx.set(sessionRef, { scored: true, score, correct, mode, scoredAt: FieldValue.serverTimestamp() })
    tx.update(userRef, {
      [`scores.${mode}`]: FieldValue.increment(score),
      'scores.global': FieldValue.increment(score),
      'stats.totalCorrect': FieldValue.increment(correct),
      'stats.totalAnswered': FieldValue.increment(answers.length),
      'stats.gamesPlayed': FieldValue.increment(1),
      xp: FieldValue.increment(score),
    })

    // Rankings agregados (global, por modo, semanal).
    const entry = { uid, displayName, photoURL, score: FieldValue.increment(score), updatedAt: FieldValue.serverTimestamp() }
    for (const scope of ['global', mode, `weekly_${wId}`]) {
      tx.set(db.collection('rankings').doc(scope).collection('entries').doc(uid), entry, { merge: true })
    }

    return { alreadyScored: false, score, correct }
  })
})

// TODO(Sprint 3): submitMatchTurn (revelação cega, B2), expireMatches (W.O., agendada),
// weeklyRankingSnapshot (agendada), deleteAccount (LGPD/exclusão, B4).
