/**
 * Parâmetros de jogo. Valores decididos na revisão do PRD (Seção 13).
 * No futuro, expor via Firebase Remote Config para tunar sem republicar.
 */
export const GAME_CONFIG = {
  /** Decisão 13.2: 6 perguntas por partida no Normal. */
  normalQuestionCount: 6,

  /** Decisão 13.3: 60s no Stop. */
  stopDurationSeconds: 60,
  /** Penalidade de tempo por erro no Stop. */
  stopWrongPenaltySeconds: 3,
  /** Bônus de pontos por responder rápido (Stop). */
  stopSpeedBonusMax: 50,

  /** Decisão 13.4: 10 níveis no Challenge, com checkpoints. */
  challengeLevels: 10,
  challengeCheckpoints: [3, 7],

  /** Pontos por dificuldade (Seção 9). */
  pointsByDifficulty: {
    facil: 100,
    medio: 200,
    dificil: 300,
  },
} as const

export type Difficulty = keyof typeof GAME_CONFIG.pointsByDifficulty

/** Dificuldade de cada nível do Challenge (escada crescente). */
export function challengeDifficultyForLevel(level: number): Difficulty {
  if (level <= 3) return 'facil'
  if (level <= 7) return 'medio'
  return 'dificil'
}

/** Recompensa acumulada ao COMPLETAR um nível (cresce com o nível). */
export function challengeRewardForLevel(level: number): number {
  return level * 150
}

/**
 * Nível "garantido" ao falhar: o maior checkpoint (ou final) já alcançado.
 * Ex.: checkpoints [3,7] → falhar no nível 5 garante a recompensa do nível 3.
 */
export function safeChallengeLevel(completedLevels: number): number {
  const milestones = [0, ...GAME_CONFIG.challengeCheckpoints, GAME_CONFIG.challengeLevels]
  return milestones.filter((m) => m <= completedLevels).reduce((a, b) => Math.max(a, b), 0)
}
