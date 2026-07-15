import { create } from 'zustand'
import type { CategoryId } from '@/types/question'
import type { GameMode } from '@/types/models'
import { loadJSON, loadJSONSync, saveJSON } from '@/lib/persist'
import { applyPlay, effectiveStreak, type StreakState } from '@/lib/streak'
import { levelProgress, xpForCorrect } from '@/lib/leveling'
import { ACHIEVEMENTS, unlockedIds, type Achievement, type AchievementContext } from '@/lib/achievements'

export interface LocalProfile {
  xp: number
  stats: { totalCorrect: number; totalAnswered: number; gamesPlayed: number }
  statsByCategory: Partial<Record<CategoryId, { correct: number; answered: number }>>
  /** melhores marcas por modo (local; reconciliadas com ranking no servidor). */
  bests: { stop: number; challengeLevel: number }
  streak: StreakState
  ftueDone: boolean
  /** ids de perguntas já vistas — para NUNCA repetir (#2). */
  seen: string[]
  /** ids de conquistas desbloqueadas. */
  achievements: string[]
}

function buildContext(p: LocalProfile): AchievementContext {
  return {
    level: levelProgress(p.xp).level,
    gamesPlayed: p.stats.gamesPlayed,
    totalCorrect: p.stats.totalCorrect,
    streakLongest: p.streak.longest,
    bestStop: p.bests.stop,
    bestChallengeLevel: p.bests.challengeLevel,
    statsByCategory: p.statsByCategory,
  }
}

const EMPTY: LocalProfile = {
  xp: 0,
  stats: { totalCorrect: 0, totalAnswered: 0, gamesPlayed: 0 },
  statsByCategory: {},
  bests: { stop: 0, challengeLevel: 0 },
  streak: { current: 0, longest: 0, lastPlayedDate: null },
  ftueDone: false,
  seen: [],
  achievements: [],
}

const KEY = 'profile'

// Hidratação SÍNCRONA a partir do localStorage: evita o flash de perfil zerado
// no cold start (auditoria P1.2). O load() assíncrono reconcilia com o
// Preferences (durável) logo em seguida.
const HYDRATED: LocalProfile = (() => {
  const s = loadJSONSync<LocalProfile>(KEY, EMPTY)
  return { ...EMPTY, ...s, bests: { ...EMPTY.bests, ...s.bests } }
})()

// Load single-flight: todos os chamadores aguardam a MESMA leitura, evitando
// que um load em voo sobrescreva progresso recém-gravado (auditoria P0.2).
let loadPromise: Promise<void> | null = null

export interface GameResult {
  mode: GameMode
  category?: CategoryId
  correct: number
  answered: number
  points: number
  stopScore?: number
  challengeLevel?: number
}

interface ProfileState {
  profile: LocalProfile
  loaded: boolean
  /** Set das perguntas vistas (memoizado por referência de `seen`). */
  seenRef: { arr: string[]; set: Set<string> }
  /** conquistas recém-desbloqueadas, para o toast (transiente). */
  justUnlocked: Achievement[]
  clearJustUnlocked: () => void
  load: () => Promise<void>
  recordGameResult: (r: GameResult) => Promise<void>
  /** Marca perguntas como vistas (chamado pelos modos ao apresentá-las). */
  markSeen: (ids: string[]) => Promise<void>
  seenSet: () => Set<string>
  completeFtue: () => Promise<void>
  resetProgress: () => Promise<void>
  level: () => number
  currentStreak: () => number
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: HYDRATED,
  loaded: false,
  seenRef: { arr: HYDRATED.seen, set: new Set(HYDRATED.seen) },
  justUnlocked: [],

  clearJustUnlocked: () => set({ justUnlocked: [] }),

  load: async () => {
    // Idempotente + single-flight: uma vez carregado, o estado em memória é a
    // fonte da verdade; enquanto carrega, todos aguardam a MESMA leitura.
    if (get().loaded) return
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      const stored = await loadJSON<LocalProfile>(KEY, EMPTY)
      // Re-checa DEPOIS do await: se outra via já marcou loaded (ex.: gravou uma
      // partida), NÃO sobrescreve o progresso recém-salvo (auditoria P0.2).
      if (get().loaded) return
      const profile = { ...EMPTY, ...stored, bests: { ...EMPTY.bests, ...stored.bests } }
      set({ profile, loaded: true, seenRef: { arr: profile.seen, set: new Set(profile.seen) } })
    })()
    try {
      await loadPromise
    } finally {
      loadPromise = null
    }
  },

  recordGameResult: async (r) => {
    // Garante que o perfil salvo já foi carregado — senão gravaríamos por cima
    // com o EMPTY (perda de progresso ao terminar a 1ª partida do lançamento).
    if (!get().loaded) await get().load()
    const p = get().profile
    const next: LocalProfile = {
      ...p,
      xp: p.xp + xpForCorrect(r.correct),
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
    // Avalia conquistas com o estado já atualizado.
    const nowUnlocked = unlockedIds(buildContext(next))
    const fresh = nowUnlocked.filter((id) => !next.achievements.includes(id))
    if (fresh.length > 0) {
      next.achievements = [...next.achievements, ...fresh]
      const objs = ACHIEVEMENTS.filter((a) => fresh.includes(a.id))
      set({ profile: next, justUnlocked: [...get().justUnlocked, ...objs] })
    } else {
      set({ profile: next })
    }
    await saveJSON(KEY, next)
  },

  markSeen: async (ids) => {
    if (ids.length === 0) return
    if (!get().loaded) await get().load()
    const { set: seen } = get().seenRef
    const fresh = ids.filter((id) => !seen.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => seen.add(id))
    const p = get().profile
    const next = { ...p, seen: [...p.seen, ...fresh] }
    set({ profile: next, seenRef: { arr: next.seen, set: seen } })
    await saveJSON(KEY, next)
  },

  seenSet: () => get().seenRef.set,

  completeFtue: async () => {
    if (!get().loaded) await get().load()
    const next = { ...get().profile, ftueDone: true }
    set({ profile: next })
    await saveJSON(KEY, next)
  },

  resetProgress: async () => {
    set({ profile: EMPTY, seenRef: { arr: [], set: new Set() } })
    await saveJSON(KEY, EMPTY)
  },

  level: () => levelProgress(get().profile.xp).level,
  currentStreak: () => effectiveStreak(get().profile.streak),
}))
