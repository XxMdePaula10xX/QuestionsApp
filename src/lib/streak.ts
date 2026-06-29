/**
 * Lógica de streak diário (motor de retenção — recomendação da revisão).
 * Datas em fuso local, no formato YYYY-MM-DD.
 */
export interface StreakState {
  current: number
  longest: number
  lastPlayedDate: string | null
}

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

/** Aplica uma partida jogada hoje ao streak. */
export function applyPlay(state: StreakState, today: string = todayKey()): StreakState {
  if (state.lastPlayedDate === today) return state // já contou hoje
  let current = 1
  if (state.lastPlayedDate && daysBetween(state.lastPlayedDate, today) === 1) {
    current = state.current + 1
  }
  return {
    current,
    longest: Math.max(state.longest, current),
    lastPlayedDate: today,
  }
}

/** Streak "vivo": zera visualmente se o jogador pulou mais de 1 dia. */
export function effectiveStreak(state: StreakState, today: string = todayKey()): number {
  if (!state.lastPlayedDate) return 0
  const gap = daysBetween(state.lastPlayedDate, today)
  if (gap <= 0) return state.current
  if (gap === 1) return state.current // jogou ontem, ainda vivo hoje
  return 0 // perdeu o streak
}
