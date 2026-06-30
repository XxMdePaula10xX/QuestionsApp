import type { Question } from '@/types/question'
import type { MatchResult } from '@/types/models'

/**
 * Lógica pura do desafio assíncrono (mesma regra usada na Cloud Function).
 * Mantida sem dependências de Firebase para ser testável e reaproveitável.
 */

/** Compara dois resultados e decide o vencedor (ou empate → null). */
export function decideWinner(
  a: { uid: string; res: MatchResult },
  b: { uid: string; res: MatchResult },
): string | null {
  if (a.res.correct !== b.res.correct) return a.res.correct > b.res.correct ? a.uid : b.uid
  // Desempate por tempo (menor vence). Empate real → null.
  if (a.res.timeMs !== b.res.timeMs) return a.res.timeMs < b.res.timeMs ? a.uid : b.uid
  return null
}

/** Pontua respostas contra o gabarito das perguntas. */
export function scoreAnswers(questions: Question[], answers: number[]): { correct: number } {
  let correct = 0
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) correct++
  })
  return { correct }
}

/** Simula o turno de um bot com um nível de habilidade (0..1). */
export function botPlay(questions: Question[], skill = 0.65, rng: () => number = Math.random): MatchResult {
  const answers = questions.map((q) => {
    if (rng() < skill) return q.answerIndex
    // resposta errada aleatória
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answerIndex)
    return wrong[Math.floor(rng() * wrong.length)]
  })
  const { correct } = scoreAnswers(questions, answers)
  return {
    correct,
    total: questions.length,
    timeMs: Math.round(2000 + rng() * 6000) * questions.length,
    finishedAt: Date.now(),
  }
}
