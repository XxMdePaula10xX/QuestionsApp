import { useCallback, useState } from 'react'
import { loadCategories, preferUnseen, shuffle } from '@/lib/questionsLoader'
import {
  GAME_CONFIG,
  challengeDifficultyForLevel,
  challengeRewardForLevel,
  safeChallengeLevel,
} from '@/lib/gameConfig'
import { PLAYABLE_CATEGORIES } from '@/lib/categories'
import { useProfileStore } from '@/stores/profileStore'
import type { Question } from '@/types/question'

export type ChallengePhase = 'idle' | 'loading' | 'playing' | 'result' | 'error'

export interface ChallengeSummary {
  completedLevels: number
  won: boolean
  points: number
}

/**
 * Modo Challenge (escada): 10 níveis de dificuldade crescente, 1 pergunta cada.
 * Errou = acabou, mas o jogador garante a recompensa do último checkpoint.
 */
export function useChallengeGame() {
  const recordGameResult = useProfileStore((s) => s.recordGameResult)
  const markSeen = useProfileStore((s) => s.markSeen)
  const seenSet = useProfileStore((s) => s.seenSet)

  const [phase, setPhase] = useState<ChallengePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ladder, setLadder] = useState<Question[]>([])
  const [level, setLevel] = useState(1) // 1-based
  const [picked, setPicked] = useState<number | null>(null)
  const [summary, setSummary] = useState<ChallengeSummary | null>(null)

  const finish = useCallback(
    async (completedLevels: number, won: boolean) => {
      const points = challengeRewardForLevel(safeChallengeLevel(completedLevels))
      setSummary({ completedLevels, won, points })
      setPhase('result')
      await recordGameResult({
        mode: 'challenge',
        correct: completedLevels,
        answered: won ? completedLevels : completedLevels + 1,
        points,
        challengeLevel: completedLevels,
      })
    },
    [recordGameResult],
  )

  const start = useCallback(async () => {
    setPhase('loading')
    setError(null)
    setLevel(1)
    setPicked(null)
    setSummary(null)
    try {
      const all = await loadCategories(PLAYABLE_CATEGORIES)
      // Prefere inéditas (#2); cai no catálogo todo se não houver suficientes.
      const pool0 = preferUnseen(all, seenSet(), GAME_CONFIG.challengeLevels)
      const byDiff = {
        facil: shuffle(pool0.filter((q) => q.difficulty === 'facil')),
        medio: shuffle(pool0.filter((q) => q.difficulty === 'medio')),
        dificil: shuffle(pool0.filter((q) => q.difficulty === 'dificil')),
      }
      const cursor = { facil: 0, medio: 0, dificil: 0 }
      const picked: Question[] = []
      const fallback = shuffle(all)
      for (let lvl = 1; lvl <= GAME_CONFIG.challengeLevels; lvl++) {
        const d = challengeDifficultyForLevel(lvl)
        const pool = byDiff[d]
        const q = pool[cursor[d]++] ?? fallback[lvl]
        picked.push(q)
      }
      if (picked.some((q) => !q)) throw new Error('Perguntas insuficientes para o Challenge')
      void markSeen(picked.map((q) => q.id))
      setLadder(picked)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
      setPhase('error')
    }
  }, [markSeen, seenSet])

  const pick = useCallback(
    (i: number) => {
      if (picked !== null || phase !== 'playing') return
      setPicked(i)
      const q = ladder[level - 1]
      const correct = i === q.answerIndex
      setTimeout(() => {
        if (!correct) {
          void finish(level - 1, false) // completou (level-1) níveis
        } else if (level >= GAME_CONFIG.challengeLevels) {
          void finish(GAME_CONFIG.challengeLevels, true) // venceu tudo
        } else {
          setLevel((l) => l + 1)
          setPicked(null)
        }
      }, 700)
    },
    [picked, phase, ladder, level, finish],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setLadder([])
    setLevel(1)
  }, [])

  return {
    phase,
    error,
    question: ladder[level - 1] ?? null,
    level,
    totalLevels: GAME_CONFIG.challengeLevels,
    checkpoints: GAME_CONFIG.challengeCheckpoints as readonly number[],
    picked,
    summary,
    start,
    pick,
    reset,
  }
}
