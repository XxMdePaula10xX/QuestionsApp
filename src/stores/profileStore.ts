import { create } from 'zustand'
import type { CategoryId } from '@/types/question'
import type { GameMode } from '@/types/models'
import { loadJSON, saveJSON } from '@/lib/persist'
import { applyPlay, effectiveStreak, type StreakState } from '@/lib/streak'
import { levelProgress } from '@/lib/leveling'

export interface LocalProfile {
  xp: number
  stats: { totalCorrect: number; totalAnswered: number; gamesPlayed: number }
  statsByCategory: Partial<Record<CategoryId, { correct: number; answered: number }>>
  /** melhores marcas por modo (local; reconciliadas com ranking no servidor). */
  bests: { stop: number; challengeLevel: number }
  streak: StreakState
  ftueDone: boolean
}

const EMPTY: LocalProfile = {
  xp: 0,
  stats: { totalCorrect: 0, totalAnswered: 0, gamesPlayed: 0 },
  statsByCategory: {},
  bests: { stop: 0, challengeLevel: 0 },
  streak: { current: 0, longest: 0, lastPlayedDate: null },
  ftueDone: false,
}

const KEY = 'profile'

export interface GameResult {
  mode: GameMode
  category?: CategoryId
  correct: number
  answered: number
  points: number
  /** Stop: pontuação final da partida (para o recorde). */
  stopScore?: number
  /** Challenge: nível alcançado. */
  challengeLevel?: number
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
    const stored = await loadJSON<LocalProfile>(KEY, EMPTY)
    // mescla com EMPTY para tolerar perfis salvos por versões antigas.
    set({ profile: { ...EMPTY, ...stored, bests: { ...EMPTY.bests, ...stored.bests } }, loaded: true })
  },

  recordGameResult: async (r) => {
    const p = get().profile
    const next: LocalProfile = {
      ...p,
      xp: p.xp + r.points,
      stats: {
        totalCorrect: p.stats.totalCorrect + r.correct,
        totalAnswered: p.stats.totalAnswered + r.answered,
        gamesPlayed: p.stats.gamesPlayed + 1,
      },
      statsByCategory: r.category
        ? {
            ...p.statsByCategory,
            [r.category]: {
              correct: (p.statsByCategory[r.category]?.correct ?? 0) + r.correct,
              answered: (p.statsByCategory[r.category]?.answered ?? 0) + r.answered,
            },
          }
        : p.statsByCategory,
      bests: {
        stop: Math.max(p.bests.stop, r.stopScore ?? 0),
        challengeLevel: Math.max(p.bests.challengeLevel, r.challengeLevel ?? 0),
      },
      streak: applyPlay(p.streak),
    }
    set({ profile: next })
    await saveJSON(KEY, next)
    // TODO(Sprint 2 prod): a Cloud Function submitScore é a fonte autoritativa
    // do score/ranking; aqui mantemos o estado local/offline reconciliável.
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
