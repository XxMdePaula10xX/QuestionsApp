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
  // Fonte da verdade para EXIBIÇÃO e perfil local: pontuação LOCAL com o gabarito
  // do bundle. Confiável e offline — não depende de o Storage do servidor estar
  // em sincronia (antes, logado, o servidor podia devolver 0 e "zerar" o
  // resultado visível). O ranking competitivo é enviado em segundo plano.
  const local = scoreLocally(input)

  const canServer = isFirebaseConfigured && functions && auth?.currentUser
  if (canServer) {
    // As opções foram embaralhadas na exibição; traduz a resposta para o índice
    // ORIGINAL, que é como o gabarito do servidor (Storage) está gravado.
    const answers = input.answers.map((a, i) => {
      const order = input.questions[i]?.__order
      return order && a >= 0 && a < order.length ? order[a] : a
    })
    const callable = httpsCallable<
      { sessionId: string; mode: GameMode; answers: number[]; questionIds: string[] },
      { score: number; correct: number; alreadyScored: boolean }
    >(functions!, 'submitScore')
    void callable({
      sessionId: newSessionId(),
      mode: input.mode,
      answers,
      questionIds: input.questions.map((q) => q.id),
    }).catch(() => {
      /* ranking best-effort — não afeta o resultado exibido */
    })
  }
  return local
}
