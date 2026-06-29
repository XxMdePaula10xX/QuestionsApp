import { useCallback, useState } from 'react'
import { drawQuestions } from '@/lib/questionsLoader'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { submitScore } from '@/lib/scoreService'
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
 * Modo Normal (solo, sem pressão de tempo). Feedback imediato usa o gabarito
 * local; a pontuação final passa pelo scoreService (Cloud Function quando
 * disponível — B1/B3 —, fallback local em dev/convidado).
 */
export function useNormalGame() {
  const recordGameResult = useProfileStore((s) => s.recordGameResult)

  const [phase, setPhase] = useState<GamePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [summary, setSummary] = useState<GameSummary | null>(null)

  const start = useCallback(async (cat: CategoryId) => {
    setPhase('loading')
    setError(null)
    setCategory(cat)
    setIndex(0)
    setPicked(null)
    setAnswers([])
    setSummary(null)
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
      setAnswers((a) => {
        const copy = [...a]
        copy[index] = i
        return copy
      })
    },
    [picked, index],
  )

  const next = useCallback(async () => {
    const isLast = index + 1 >= questions.length
    if (!isLast) {
      setIndex((i) => i + 1)
      setPicked(null)
      return
    }
    const result = await submitScore({ mode: 'normal', questions, answers })
    if (category) {
      await recordGameResult({
        mode: 'normal',
        category,
        correct: result.correct,
        answered: questions.length,
        points: result.points,
      })
      setSummary({ category, total: questions.length, correct: result.correct, points: result.points })
    }
    setPhase('result')
  }, [index, questions, answers, category, recordGameResult])

  const reset = useCallback(() => {
    setPhase('idle')
    setQuestions([])
    setCategory(null)
  }, [])

  const current = questions[index] ?? null
  const isCorrect = picked !== null && current ? picked === current.answerIndex : null

  return {
    phase,
    error,
    question: current,
    index,
    total: questions.length,
    picked,
    isCorrect,
    summary,
    start,
    pick,
    next,
    reset,
  }
}
