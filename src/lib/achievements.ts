import type { CategoryId } from '@/types/question'
import { PLAYABLE_CATEGORIES } from '@/lib/categories'

/** Contexto avaliado contra o perfil local (sem dependência de store). */
export interface AchievementContext {
  level: number
  gamesPlayed: number
  totalCorrect: number
  streakLongest: number
  bestStop: number
  bestChallengeLevel: number
  statsByCategory: Partial<Record<CategoryId, { correct: number; answered: number }>>
}

export interface Achievement {
  id: string
  emoji: string
  title: string
  desc: string
  /** valor atual e alvo para a barra de progresso. */
  progress: (c: AchievementContext) => { current: number; target: number }
}

function categoriesPlayed(c: AchievementContext): number {
  return PLAYABLE_CATEGORIES.filter((id) => (c.statsByCategory[id]?.answered ?? 0) > 0).length
}

/** Catálogo de conquistas — nomenclatura com sotaque brasileiro (ideia #12). */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'estagiario', emoji: '🐣', title: 'Estagiário do Saber', desc: 'Jogue sua primeira partida', progress: (c) => ({ current: c.gamesPlayed, target: 1 }) },
  { id: 'dedicado', emoji: '📚', title: 'Cabeça de Estudo', desc: 'Jogue 10 partidas', progress: (c) => ({ current: c.gamesPlayed, target: 10 }) },
  { id: 'maratonista', emoji: '🏃', title: 'Maratonista do Quiz', desc: 'Jogue 50 partidas', progress: (c) => ({ current: c.gamesPlayed, target: 50 }) },
  { id: 'cuca', emoji: '🧠', title: 'Cuca Fundida', desc: 'Acerte 100 perguntas', progress: (c) => ({ current: c.totalCorrect, target: 100 }) },
  { id: 'enciclopedia', emoji: '📖', title: 'Enciclopédia Ambulante', desc: 'Acerte 500 perguntas', progress: (c) => ({ current: c.totalCorrect, target: 500 }) },
  { id: 'cabra', emoji: '🌵', title: 'Cabra da Peste', desc: 'Mantenha um streak de 7 dias', progress: (c) => ({ current: c.streakLongest, target: 7 }) },
  { id: 'ferro', emoji: '🔥', title: 'Cabra de Ferro', desc: 'Mantenha um streak de 30 dias', progress: (c) => ({ current: c.streakLongest, target: 30 }) },
  { id: 'nivel10', emoji: '⭐', title: 'Doutor do Boteco', desc: 'Alcance o nível 10', progress: (c) => ({ current: c.level, target: 10 }) },
  { id: 'nivel25', emoji: '🎓', title: 'Sabidão Federal Concursado', desc: 'Alcance o nível 25', progress: (c) => ({ current: c.level, target: 25 }) },
  { id: 'relampago', emoji: '⚡', title: 'Dedo de Relâmpago', desc: 'Faça 800+ pontos no modo Stop', progress: (c) => ({ current: c.bestStop, target: 800 }) },
  { id: 'milionario', emoji: '🪜', title: 'Quem Quer Ser Sabido', desc: 'Vença o Challenge (nível 10)', progress: (c) => ({ current: c.bestChallengeLevel, target: 10 }) },
  { id: 'tupiniquim', emoji: '🇧🇷', title: 'Raiz do Brasil', desc: 'Acerte 50 perguntas da categoria Brasil', progress: (c) => ({ current: c.statsByCategory.brasil?.correct ?? 0, target: 50 }) },
  { id: 'poliglota', emoji: '🗺️', title: 'Pau Pra Toda Obra', desc: 'Jogue todas as 7 categorias', progress: (c) => ({ current: categoriesPlayed(c), target: PLAYABLE_CATEGORIES.length }) },
]

export function isUnlocked(a: Achievement, c: AchievementContext): boolean {
  const { current, target } = a.progress(c)
  return current >= target
}

/** Retorna os ids desbloqueados dado o contexto. */
export function unlockedIds(c: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, c)).map((a) => a.id)
}
