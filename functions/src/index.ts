/**
 * Cloud Functions — Sabido (scaffold do Sprint 0).
 *
 * Concentra o anti-cheat server-side da revisão:
 *  - B1: o GABARITO é resolvido aqui (fonte server-side), nunca no device.
 *  - B3: a pontuação é IDEMPOTENTE (sessionId + flag `scored`) e usa transação
 *        com FieldValue.increment para evitar double-credit e write contention.
 *  - timeMs é medido no servidor, não confiando no cliente.
 *
 * Os corpos marcados com TODO são implementados no Sprint 2. Este arquivo
 * compila e define os contratos (assinaturas + tipos) que o cliente usará.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 })

type Difficulty = 'facil' | 'medio' | 'dificil'
const POINTS: Record<Difficulty, number> = { facil: 100, medio: 200, dificil: 300 }

interface SubmitScorePayload {
  sessionId: string
  mode: 'normal' | 'stop' | 'challenge'
  /** índices escolhidos pelo jogador, na ordem das perguntas servidas. */
  answers: number[]
  /** ids das perguntas servidas nesta sessão (gabarito resolvido no servidor). */
  questionIds: string[]
}

/**
 * Resolve o gabarito a partir da fonte SERVER-SIDE (B1).
 * TODO(Sprint 2): ler do Storage (JSON com read negado a clientes) ou de uma
 * coleção Firestore restrita, na versão registrada para a sessão.
 */
async function resolveAnswerKey(_questionIds: string[]): Promise<{ index: number; difficulty: Difficulty }[]> {
  throw new HttpsError('unimplemented', 'resolveAnswerKey será implementado no Sprint 2')
}

export const submitScore = onCall<SubmitScorePayload>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário')

  const { sessionId, mode, answers, questionIds } = request.data
  if (!sessionId || !Array.isArray(answers) || !Array.isArray(questionIds)) {
    throw new HttpsError('invalid-argument', 'Payload inválido')
  }

  // Idempotência (B3): a sessão é a chave; re-submissões são rejeitadas/no-op.
  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId)

  return db.runTransaction(async (tx) => {
    const session = await tx.get(sessionRef)
    if (session.exists && session.get('scored') === true) {
      return { alreadyScored: true, score: session.get('score') ?? 0 }
    }

    const key = await resolveAnswerKey(questionIds)
    let correct = 0
    let score = 0
    answers.forEach((a, i) => {
      if (key[i] && a === key[i].index) {
        correct++
        score += POINTS[key[i].difficulty]
      }
    })

    // Crédito atômico (evita contention/double-credit).
    const userRef = db.collection('users').doc(uid)
    tx.set(sessionRef, { scored: true, score, correct, mode, scoredAt: FieldValue.serverTimestamp() })
    tx.update(userRef, {
      [`scores.${mode}`]: FieldValue.increment(score),
      'scores.global': FieldValue.increment(score),
      'stats.totalCorrect': FieldValue.increment(correct),
      'stats.totalAnswered': FieldValue.increment(answers.length),
      'stats.gamesPlayed': FieldValue.increment(1),
      xp: FieldValue.increment(score),
    })

    // TODO(Sprint 2): atualizar rankings/{global|mode|weekly_<weekId>}/entries/{uid}.
    return { alreadyScored: false, score, correct }
  })
})

// TODO(Sprint 3): submitMatchTurn (revelação cega, B2), expireMatches (W.O., agendada),
// weeklyRankingSnapshot (agendada), deleteAccount (LGPD/exclusão, B4).
