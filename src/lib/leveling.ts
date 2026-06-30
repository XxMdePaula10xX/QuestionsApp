/**
 * Curva de XP/nível.
 *
 * XP é DESACOPLADO dos pontos de ranking: cada acerto vale `XP_PER_CORRECT`,
 * independente da dificuldade, para a progressão de nível ser estável e não
 * "disparar" (os pontos de dificuldade alimentam só o ranking).
 *
 * XP acumulado para ATINGIR o nível L: 75 * (L-1) * L
 *   L2=150, L3=450, L4=900, L5=1500, L10=6750.
 * Com ~4 acertos/partida (≈40 XP), o nível 2 vem em ~4 partidas e a escalada
 * fica progressivamente mais lenta.
 */
export const XP_PER_CORRECT = 10

export function xpForCorrect(correct: number): number {
  return correct * XP_PER_CORRECT
}

export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0
  return 75 * (level - 1) * level
}

export interface LevelProgress {
  level: number
  /** XP acumulado dentro do nível atual. */
  intoLevel: number
  /** XP total necessário para subir do nível atual para o próximo. */
  span: number
  /** 0..1 — fração do nível atual já preenchida. */
  ratio: number
}

export function levelProgress(totalXp: number): LevelProgress {
  let level = 1
  while (totalXp >= xpToReachLevel(level + 1)) level++
  const base = xpToReachLevel(level)
  const next = xpToReachLevel(level + 1)
  const span = next - base
  const intoLevel = totalXp - base
  return { level, intoLevel, span, ratio: span > 0 ? intoLevel / span : 0 }
}
