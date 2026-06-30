/**
 * Cloud Functions — Sabido.
 *
 * Anti-cheat / integridade da revisão:
 *  - B1: GABARITO resolvido aqui (lido do Storage), nunca no device.
 *  - B2: desafio assíncrono com REVELAÇÃO CEGA — respostas em subcoleção privada
 *        por jogador; o resultado público só é escrito quando ambos terminam.
 *  - B3: pontuação IDEMPOTENTE (sessionId / submissão única por jogador) em
 *        transação com FieldValue.increment.
 *  - Amizade MÚTUA escrita nos dois lados atomicamente (revisão).
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Transaction } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getMessaging } from 'firebase-admin/messaging'

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 })

type Difficulty = 'facil' | 'medio' | 'dificil'
type GameMode = 'normal' | 'stop' | 'challenge'
const POINTS: Record<Difficulty, number> = { facil: 100, medio: 200, dificil: 300 }
const MATCH_QUESTIONS = 5
const MATCH_EXPIRY_MS = 3 * 86_400_000

interface KeyEntry {
  index: number
  difficulty: Difficulty
}
let answerKeyCache: Map<string, KeyEntry> | null = null

async function loadAnswerKey(): Promise<Map<string, KeyEntry>> {
  if (answerKeyCache) return answerKeyCache
  const bucket = getStorage().bucket()
  const [manifestBuf] = await bucket.file('questions/manifest.json').download()
  const manifest = JSON.parse(manifestBuf.toString()) as { categories: { file: string }[] }
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

function weekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function requireAuth(request: CallableRequest): string {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário')
  return uid
}

async function notify(uid: string, title: string, body: string): Promise<void> {
  try {
    const tokensSnap = await db.collection('users').doc(uid).collection('tokens').get()
    const tokens = tokensSnap.docs.map((d) => d.id)
    if (tokens.length === 0) return
    await getMessaging().sendEachForMulticast({ tokens, notification: { title, body } })
  } catch {
    /* push é best-effort */
  }
}

// =================== Pontuação solo (Normal/Stop/Challenge) ===================
interface SubmitScorePayload {
  sessionId: string
  mode: GameMode
  answers: number[]
  questionIds: string[]
}

export const submitScore = onCall<SubmitScorePayload>(async (request) => {
  const uid = requireAuth(request)
  const { sessionId, mode, answers, questionIds } = request.data
  if (!sessionId || !Array.isArray(answers) || !Array.isArray(questionIds)) {
    throw new HttpsError('invalid-argument', 'Payload inválido')
  }
  if (!['normal', 'stop', 'challenge'].includes(mode)) throw new HttpsError('invalid-argument', 'Modo inválido')

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

    tx.set(sessionRef, { scored: true, score, correct, mode, scoredAt: FieldValue.serverTimestamp() })
    tx.update(userRef, {
      [`scores.${mode}`]: FieldValue.increment(score),
      'scores.global': FieldValue.increment(score),
      'stats.totalCorrect': FieldValue.increment(correct),
      'stats.totalAnswered': FieldValue.increment(answers.length),
      'stats.gamesPlayed': FieldValue.increment(1),
      xp: FieldValue.increment(score),
    })
    const entry = { uid, displayName, photoURL, score: FieldValue.increment(score), updatedAt: FieldValue.serverTimestamp() }
    for (const scope of ['global', mode, `weekly_${wId}`]) {
      tx.set(db.collection('rankings').doc(scope).collection('entries').doc(uid), entry, { merge: true })
    }
    return { alreadyScored: false, score, correct }
  })
})

// =================== Desafio assíncrono ===================
function decideWinner(a: { uid: string; correct: number; timeMs: number }, b: { uid: string; correct: number; timeMs: number }): string | null {
  if (a.correct !== b.correct) return a.correct > b.correct ? a.uid : b.uid
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? a.uid : b.uid
  return null
}

interface CreateMatchPayload {
  opponentUid: string | null // null => aleatório
  category: string | null
}

export const createMatch = onCall<CreateMatchPayload>(async (request) => {
  const uid = requireAuth(request)
  let opponent = request.data.opponentUid
  if (opponent === uid) throw new HttpsError('invalid-argument', 'Não pode desafiar a si mesmo')

  if (!opponent) {
    // Matchmaking aleatório server-side (cliente não escolhe o oponente).
    const candidates = await db.collection('users').limit(20).get()
    const pool = candidates.docs.map((d) => d.id).filter((id) => id !== uid)
    if (pool.length === 0) throw new HttpsError('failed-precondition', 'Sem oponentes disponíveis')
    opponent = pool[Math.floor(Math.random() * pool.length)]
  }

  const key = await loadAnswerKey()
  const ids = [...key.keys()]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  const questionIds = ids.slice(0, MATCH_QUESTIONS)

  const [meSnap, oppSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(opponent).get(),
  ])
  const now = Date.now()
  const ref = db.collection('matches').doc()
  await ref.set({
    players: [uid, opponent],
    playerNames: {
      [uid]: meSnap.get('displayName') ?? 'Jogador',
      [opponent]: oppSnap.get('displayName') ?? 'Jogador',
    },
    category: request.data.category ?? null,
    questionIds,
    status: 'WAITING',
    results: {},
    winnerId: null,
    createdAt: now,
    expiresAt: now + MATCH_EXPIRY_MS,
  })
  await notify(opponent, 'Novo desafio! ⚔️', `${meSnap.get('displayName') ?? 'Alguém'} te desafiou no Sabido.`)
  return { matchId: ref.id, questionIds }
})

interface SubmitTurnPayload {
  matchId: string
  answers: number[]
}

export const submitMatchTurn = onCall<SubmitTurnPayload>(async (request) => {
  const uid = requireAuth(request)
  const { matchId, answers } = request.data
  if (!matchId || !Array.isArray(answers)) throw new HttpsError('invalid-argument', 'Payload inválido')

  const key = await loadAnswerKey()
  const matchRef = db.collection('matches').doc(matchId)
  const mySubRef = matchRef.collection('submissions').doc(uid)

  return db.runTransaction(async (tx: Transaction) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpsError('not-found', 'Partida não encontrada')
    const match = matchSnap.data() as {
      players: string[]
      questionIds: string[]
      status: string
    }
    if (!match.players.includes(uid)) throw new HttpsError('permission-denied', 'Você não é jogador desta partida')
    if (match.status === 'FINISHED' || match.status === 'EXPIRED') {
      throw new HttpsError('failed-precondition', 'Partida encerrada')
    }

    const otherUid = match.players.find((p) => p !== uid)!
    const [mySubSnap, otherSubSnap] = await Promise.all([tx.get(mySubRef), tx.get(matchRef.collection('submissions').doc(otherUid))])
    if (mySubSnap.exists) return { alreadySubmitted: true } // idempotente (B3)

    // Pontua server-side com o gabarito (B1).
    let correct = 0
    match.questionIds.forEach((qid, i) => {
      const k = key.get(qid)
      if (k && answers[i] === k.index) correct++
    })
    const timeMs = 0 // TODO: medir server-side (revisão) — placeholder.
    tx.set(mySubRef, { answers, correct, timeMs, submittedAt: FieldValue.serverTimestamp() })

    if (otherSubSnap.exists) {
      // Ambos terminaram → revela resultado (B2).
      const other = otherSubSnap.data() as { correct: number; timeMs: number }
      const total = match.questionIds.length
      const winnerId = decideWinner(
        { uid, correct, timeMs },
        { uid: otherUid, correct: other.correct, timeMs: other.timeMs },
      )
      tx.update(matchRef, {
        status: 'FINISHED',
        winnerId,
        results: {
          [uid]: { correct, total, timeMs, finishedAt: Date.now() },
          [otherUid]: { correct: other.correct, total, timeMs: other.timeMs, finishedAt: Date.now() },
        },
      })
      return { finished: true }
    } else {
      // Primeiro a terminar — NÃO revela nada ao oponente.
      tx.update(matchRef, { status: uid === match.players[0] ? 'A_DONE' : 'B_DONE' })
      return { finished: false }
    }
  })
})

/** Expira desafios parados além do prazo, com W.O. para quem já jogou. */
export const expireMatches = onSchedule('every 6 hours', async () => {
  const now = Date.now()
  const snap = await db
    .collection('matches')
    .where('status', 'in', ['WAITING', 'A_DONE', 'B_DONE'])
    .where('expiresAt', '<', now)
    .limit(200)
    .get()
  const batch = db.batch()
  snap.docs.forEach((doc) => {
    const m = doc.data() as { players: string[]; status: string }
    let winnerId: string | null = null
    if (m.status === 'A_DONE') winnerId = m.players[0]
    else if (m.status === 'B_DONE') winnerId = m.players[1]
    batch.update(doc.ref, { status: 'EXPIRED', winnerId })
  })
  await batch.commit()
})

/** Congela o top da semana anterior (snapshot) — reset é implícito pelo weekId. */
export const weeklyRankingSnapshot = onSchedule('5 0 * * 1', async () => {
  const lastWeek = weekId(new Date(Date.now() - 7 * 86_400_000))
  const top = await db
    .collection('rankings')
    .doc(`weekly_${lastWeek}`)
    .collection('entries')
    .orderBy('score', 'desc')
    .limit(3)
    .get()
  await db.collection('rankings').doc(`weekly_${lastWeek}`).set(
    {
      closed: true,
      winners: top.docs.map((d) => ({ uid: d.id, displayName: d.get('displayName'), score: d.get('score') })),
      closedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
})

// =================== Amizades (mútuas) ===================
export const sendFriendRequest = onCall<{ toUid: string }>(async (request) => {
  const uid = requireAuth(request)
  const toUid = request.data.toUid
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Destino inválido')
  const me = await db.collection('users').doc(uid).get()
  if (!me.exists) throw new HttpsError('failed-precondition', 'Perfil inexistente')
  await db.collection('users').doc(toUid).collection('friendRequests').doc(uid).set({
    fromUid: uid,
    fromName: me.get('displayName') ?? 'Jogador',
    fromUsername: me.get('username') ?? '',
    createdAt: Date.now(),
  })
  await notify(toUid, 'Pedido de amizade 👋', `${me.get('displayName') ?? 'Alguém'} quer ser seu amigo.`)
  return { ok: true }
})

export const respondFriendRequest = onCall<{ fromUid: string; accept: boolean }>(async (request) => {
  const uid = requireAuth(request)
  const { fromUid, accept } = request.data
  const reqRef = db.collection('users').doc(uid).collection('friendRequests').doc(fromUid)
  const reqSnap = await reqRef.get()
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Pedido inexistente')

  if (accept) {
    const [a, b] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('users').doc(fromUid).get()])
    const now = Date.now()
    const batch = db.batch()
    batch.set(db.collection('users').doc(uid).collection('friends').doc(fromUid), {
      uid: fromUid,
      displayName: b.get('displayName') ?? 'Jogador',
      username: b.get('username') ?? '',
      photoURL: b.get('photoURL') ?? null,
      since: now,
    })
    batch.set(db.collection('users').doc(fromUid).collection('friends').doc(uid), {
      uid,
      displayName: a.get('displayName') ?? 'Jogador',
      username: a.get('username') ?? '',
      photoURL: a.get('photoURL') ?? null,
      since: now,
    })
    batch.delete(reqRef)
    await batch.commit()
  } else {
    await reqRef.delete()
  }
  return { ok: true, accepted: accept }
})
