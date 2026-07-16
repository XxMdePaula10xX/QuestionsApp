/**
 * Schema da pergunta. Espelha a Seção 4.4 do PRD, com os campos extras
 * recomendados na revisão (proveniência + versionamento temporal — blocker B5).
 */
export type CategoryId =
  | 'geografia'
  | 'historia'
  | 'ciencias'
  | 'esporte'
  | 'arte'
  | 'entretenimento'
  | 'brasil'

export type Difficulty = 'facil' | 'medio' | 'dificil'

/** Volatilidade — perguntas perecíveis precisam de re-verificação periódica. */
export type Volatility = 'estavel' | 'perecivel'

/**
 * Pergunta como vive no JSON estático (modo Normal solo / offline).
 *
 * IMPORTANTE (blocker B1): para os MODOS COMPETITIVOS (Stop/Challenge/Desafio)
 * o `answerIndex` e a `explanation` NÃO devem ser enviados ao device — a Cloud
 * Function é a fonte única do gabarito. Use `PublicQuestion` nesses fluxos.
 */
export interface Question {
  id: string
  category: CategoryId
  difficulty: Difficulty
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  tags: string[]
  version: number
  /** Proveniência da resposta (ground truth). Opcional na amostra do Sprint 0. */
  source?: string
  /** Default: 'estavel'. Perecíveis disparam re-verificação. */
  volatility?: Volatility
  /**
   * Transiente: quando as opções são embaralhadas na exibição, guarda o mapa
   * novaPosição→índiceOriginal, para traduzir a resposta ao gabarito ORIGINAL
   * na submissão ao servidor. Não é persistido.
   */
  __order?: number[]
}

/** Pergunta servida ao device em modos competitivos: sem gabarito. */
export type PublicQuestion = Omit<Question, 'answerIndex' | 'explanation'>

/** Arquivo JSON de uma categoria (em /public/questions/{id}.json). */
export interface CategoryFile {
  category: CategoryId
  version: number
  questions: Question[]
}

/** Manifesto — espelha `config/questionsManifest` (Seção 7). */
export interface QuestionsManifest {
  version: number
  categories: {
    id: CategoryId
    file: string
    count: number
    version: number
    /** checksum recomendado na revisão para integridade do JSON. */
    sha256?: string
  }[]
}

export function toPublicQuestion(q: Question): PublicQuestion {
  const { answerIndex: _a, explanation: _e, ...pub } = q
  return pub
}
