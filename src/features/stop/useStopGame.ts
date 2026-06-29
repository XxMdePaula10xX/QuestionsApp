import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCategory, shuffle } from '@/lib/questionsLoader'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { useProfileStore } from '@/stores/profileStore'
import type { CategoryId, Question } from '@/types/question'

export type StopPhase = 'idle' | 'loading' | 'playing' | 'result' | 'error'

/**
 * Modo Stop (contra o tempo): responda o máximo em 60s. Acerto soma pontos +
 * bônus de velocidade; erro desconta tempo. Avança automaticamente.
 *
 * NOTA (revisão): em produção o tempo deve ser medido no servidor (anti-spoof).
 * Aqui o Stop pontua localmente para o loop solo; a validação server-side do
 * ranking competitivo é refinamento de produção.
 */
export function useStopGame() {
  const recordGameResult = useProfileStore((s) => s.recordGameResult)

  const [phase, setPhase] = useState<StopPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [pool, setPool] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(GAME_CONFIG.stopDurationSeconds)

  const deadlineRef = useRef<number>(0)
  const shownAtRef = useRef<number>(0)
  const finishedRef = useRef(false)

  const finish = useCallback(async () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setPhase('result')
    await recordGameResult({
      mode: 'stop',
      category: category ?? undefined,
      correct,
      answered,
      points: score,
      stopScore: score,
    })
  }, [recordGameResult, category, correct, answered, score])

  // Timer.
  useEffect(() => {
    if (phase !== 'playing') return
    const t = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now())
      setTimeLeft(Math.ceil(left / 1000))
      if (left <= 0) {
        clearInterval(t)
        void finish()
      }
    }, 100)
    return () => clearInterval(t)
  }, [phase, finish])

  const start = useCallback(async (cat: CategoryId) => {
    setPhase('loading')
    setError(null)
    setCategory(cat)
    setIdx(0)
    setPicked(null)
    setScore(0)
    setCorrect(0)
    setAnswered(0)
    finishedRef.current = false
    try {
      const all = await loadCategory(cat)
      if (all.length === 0) throw new Error('Categoria sem perguntas')
      setPool(shuffle(all))
      deadlineRef.current = Date.now() + GAME_CONFIG.stopDurationSeconds * 1000
      shownAtRef.current = Date.now()
      setTimeLeft(GAME_CONFIG.stopDurationSeconds)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
      setPhase('error')
    }
  }, [])

  const pick = useCallback(
    (i: number) => {
      if (picked !== null || phase !== 'playing') return
      const q = pool[idx]
      setPicked(i)
      setAnswered((a) => a + 1)
      if (i === q.answerIndex) {
        const elapsed = (Date.now() - shownAtRef.current) / 1000
        const speedBonus = Math.round(Math.max(0, 1 - elapsed / 8) * GAME_CONFIG.stopSpeedBonusMax)
        setScore((s) => s + GAME_CONFIG.pointsByDifficulty[q.difficulty] + speedBonus)
        setCorrect((c) => c + 1)
      } else {
        deadlineRef.current -= GAME_CONFIG.stopWrongPenaltySeconds * 1000
      }
      // Avança automaticamente após o flash de feedback.
      setTimeout(() => {
        if (finishedRef.current) return
        setPicked(null)
        setIdx((n) => (n + 1) % pool.length) // recicla o pool se acabar
        shownAtRef.current = Date.now()
      }, 600)
    },
    [picked, phase, pool, idx],
  )

  const reset = useCallback(() => {
    finishedRef.current = false
    setPhase('idle')
    setPool([])
    setCategory(null)
  }, [])

  return {
    phase,
    error,
    question: pool[idx] ?? null,
    picked,
    score,
    correct,
    answered,
    timeLeft,
    category,
    start,
    pick,
    reset,
  }
}
