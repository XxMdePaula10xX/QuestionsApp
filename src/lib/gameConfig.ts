/**
 * Parâmetros de jogo. Valores decididos na revisão do PRD (Seção 13).
 * No futuro, expor via Firebase Remote Config para tunar sem republicar.
 */
export const GAME_CONFIG = {
  /** Decisão 13.2: 6 perguntas por partida no Normal. */
  normalQuestionCount: 6,
  /** Decisão 13.3: 60s no Stop. */
  stopDurationSeconds: 60,
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
