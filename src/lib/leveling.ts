/**
 * Curva de XP/nível. Cada nível L exige 100*L de XP a mais que o anterior,
 * então o XP acumulado para ATINGIR o nível L é 100 * (L-1)*L/2.
 */
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0
  return 100 * ((level - 1) * level) / 2
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
