import { useCallback, useState } from 'react'
import { drawQuestions } from '@/lib/questionsLoader'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { useProfileStore } from '@/stores/profileStore'
import type { CategoryId, Question } from '@/types/question'

export type GamePhase = 'idle' | 'loading' | 'playing' | 'result' | 'error'

export interface GameSummary {
  category: CategoryId
  total: number
  correct: number
  points: number
}

/**
 * Modo Normal (solo, sem pressão de tempo). Pontuação local: o Normal não pesa
 * em ranking competitivo, então o gabarito local é aceitável (revisão, B1).
 * Os modos competitivos validarão via Cloud Function.
 */
export function useNormalGame() {
  const recordGameResult = useProfileStore((s) => s.recordGameResult)

  const [phase, setPhase] = useState<GamePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [points, setPoints] = useState(0)

  const start = useCallback(async (cat: CategoryId) => {
    setPhase('loading')
    setError(null)
    setCategory(cat)
    setIndex(0)
    setPicked(null)
    setCorrect(0)
    setPoints(0)
    try {
      const qs = await drawQuestions(cat, GAME_CONFIG.normalQuestionCount)
      if (qs.length === 0) throw new Error('Categoria sem perguntas')
      setQuestions(qs)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
      setPhase('error')
    }
  }, [])

  const pick = useCallback(
    (i: number) => {
      if (picked !== null) return
      setPicked(i)
      const q = questions[index]
      if (i === q.answerIndex) {
        setCorrect((c) => c + 1)
        setPoints((p) => p + GAME_CONFIG.pointsByDifficulty[q.difficulty])
      }
    },
    [picked, questions, index],
  )

  const next = useCallback(async () => {
    const isLast = index + 1 >= questions.length
    if (isLast) {
      if (category) {
        await recordGameResult({
          category,
          correct,
          answered: questions.length,
          points,
        })
      }
      setPhase('result')
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
  }, [index, questions.length, category, correct, points, recordGameResult])

  const reset = useCallback(() => {
    setPhase('idle')
    setQuestions([])
    setCategory(null)
  }, [])

  const summary: GameSummary | null =
    category && phase === 'result'
      ? { category, total: questions.length, correct, points }
      : null

  return {
    phase,
    error,
    question: questions[index] ?? null,
    index,
    total: questions.length,
    picked,
    correct,
    points,
    summary,
    start,
    pick,
    next,
    reset,
  }
}
