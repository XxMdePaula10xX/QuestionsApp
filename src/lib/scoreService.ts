import { httpsCallable } from 'firebase/functions'
import { functions, isFirebaseConfigured } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { GAME_CONFIG } from '@/lib/gameConfig'
import type { GameMode } from '@/types/models'
import type { Question } from '@/types/question'

/**
 * Submissão de pontuação. Em produção, a fonte de verdade é a Cloud Function
 * `submitScore` (gabarito server-side — B1; idempotência — B3). Em dev/convidado
 * (sem Firebase ou sem login) cai no cálculo local com o gabarito do bundle.
 */

export interface ScoreInput {
  mode: GameMode
  questions: Question[]
  /** índice escolhido por pergunta; -1 = não respondida/errada. */
  answers: number[]
}

export interface ScoreResult {
  correct: number
  points: number
  /** true quando validado pela Cloud Function (autoritativo). */
  fromServer: boolean
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
}

function scoreLocally({ questions, answers }: ScoreInput): ScoreResult {
  let correct = 0
  let points = 0
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) {
      correct++
      points += GAME_CONFIG.pointsByDifficulty[q.difficulty]
    }
  })
  return { correct, points, fromServer: false }
}

export async function submitScore(input: ScoreInput): Promise<ScoreResult> {
  const canServer = isFirebaseConfigured && functions && auth?.currentUser
  if (!canServer) return scoreLocally(input)

  try {
    const callable = httpsCallable<
      { sessionId: string; mode: GameMode; answers: number[]; questionIds: string[] },
      { score: number; correct: number; alreadyScored: boolean }
    >(functions!, 'submitScore')
    const res = await callable({
      sessionId: newSessionId(),
      mode: input.mode,
      answers: input.answers,
      questionIds: input.questions.map((q) => q.id),
    })
    return { correct: res.data.correct, points: res.data.score, fromServer: true }
  } catch {
    // Falha de rede/Function — usa local como provisório (reconciliação depois).
    return scoreLocally(input)
  }
}
