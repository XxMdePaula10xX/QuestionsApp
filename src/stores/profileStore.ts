import { create } from 'zustand'
import type { CategoryId } from '@/types/question'
import { loadJSON, saveJSON } from '@/lib/persist'
import { applyPlay, effectiveStreak, type StreakState } from '@/lib/streak'
import { levelProgress } from '@/lib/leveling'

export interface LocalProfile {
  xp: number
  stats: { totalCorrect: number; totalAnswered: number; gamesPlayed: number }
  statsByCategory: Partial<Record<CategoryId, { correct: number; answered: number }>>
  streak: StreakState
  ftueDone: boolean
}

const EMPTY: LocalProfile = {
  xp: 0,
  stats: { totalCorrect: 0, totalAnswered: 0, gamesPlayed: 0 },
  statsByCategory: {},
  streak: { current: 0, longest: 0, lastPlayedDate: null },
  ftueDone: false,
}

const KEY = 'profile'

export interface GameResult {
  category: CategoryId
  correct: number
  answered: number
  points: number
}

interface ProfileState {
  profile: LocalProfile
  loaded: boolean
  load: () => Promise<void>
  recordGameResult: (r: GameResult) => Promise<void>
  completeFtue: () => Promise<void>
  resetProgress: () => Promise<void>
  level: () => number
  currentStreak: () => number
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: EMPTY,
  loaded: false,

  load: async () => {
    const profile = await loadJSON<LocalProfile>(KEY, EMPTY)
    set({ profile, loaded: true })
  },

  recordGameResult: async ({ category, correct, answered, points }) => {
    const p = get().profile
    const cat = p.statsByCategory[category] ?? { correct: 0, answered: 0 }
    const next: LocalProfile = {
      ...p,
      xp: p.xp + points,
      stats: {
        totalCorrect: p.stats.totalCorrect + correct,
        totalAnswered: p.stats.totalAnswered + answered,
        gamesPlayed: p.stats.gamesPlayed + 1,
      },
      statsByCategory: {
        ...p.statsByCategory,
        [category]: { correct: cat.correct + correct, answered: cat.answered + answered },
      },
      streak: applyPlay(p.streak),
    }
    set({ profile: next })
    await saveJSON(KEY, next)
    // TODO(Sprint 2): reconciliar com Firestore via Cloud Function submitScore.
  },

  completeFtue: async () => {
    const next = { ...get().profile, ftueDone: true }
    set({ profile: next })
    await saveJSON(KEY, next)
  },

  resetProgress: async () => {
    set({ profile: EMPTY })
    await saveJSON(KEY, EMPTY)
  },

  level: () => levelProgress(get().profile.xp).level,
  currentStreak: () => effectiveStreak(get().profile.streak),
}))
