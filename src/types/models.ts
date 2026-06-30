import type { CategoryId } from './question'

/**
 * Modelos do Firestore. Espelham a Seção 7 do PRD com os ajustes da revisão:
 * - PII (email) movida para subdocumento privado (blocker B4).
 * - statsByCategory adicionado para a tela de Perfil (8.6).
 * - Campos de jogo (scores/level/xp/stats) só escritos por Cloud Function.
 */

export type GameMode = 'normal' | 'stop' | 'challenge'

/** users/{uid} — perfil PÚBLICO (sem PII). */
export interface UserProfile {
  uid: string
  displayName: string
  /** handle único para busca/convite de amigos. */
  username: string
  photoURL: string | null
  level: number
  xp: number
  stats: {
    totalCorrect: number
    totalAnswered: number
    gamesPlayed: number
  }
  statsByCategory: Partial<Record<CategoryId, { correct: number; answered: number }>>
  scores: {
    global: number
    normal: number
    stop: number
    challenge: number
  }
  createdAt: number
  schemaVersion: number
}

/** users/{uid}/private/{uid} — PII, read só do próprio uid (blocker B4). */
export interface UserPrivate {
  email: string | null
  /** Aceite de termos/privacidade (LGPD). */
  acceptedTermsAt?: number
  /** Faixa etária declarada no gate de idade. */
  birthYear?: number
}

/** rankings/{scope}/entries/{uid} — escrito só por Cloud Function. */
export interface RankingEntry {
  uid: string
  displayName: string
  photoURL: string | null
  score: number
  updatedAt: number
}

/** users/{uid}/friends/{friendUid} — amizade mútua. */
export interface Friend {
  uid: string
  displayName: string
  username: string
  photoURL: string | null
  since: number
}

/** users/{uid}/friendRequests/{fromUid} — pedido (escrito por Cloud Function). */
export interface FriendRequest {
  fromUid: string
  fromName: string
  fromUsername: string
  createdAt: number
}

export type MatchStatus = 'WAITING' | 'A_DONE' | 'B_DONE' | 'FINISHED' | 'EXPIRED'

/** Resumo público de um jogador — só preenchido pela Function ao FINISHED (B2). */
export interface MatchResult {
  correct: number
  total: number
  timeMs: number
  finishedAt: number
}

/**
 * matches/{matchId} — desafio assíncrono. Doc com campos PÚBLICOS apenas.
 * As respostas de cada jogador ficam em matches/{id}/submissions/{uid} (privado),
 * e `results` só é revelado quando ambos terminam (revelação cega — B2).
 */
export interface Match {
  id: string
  players: string[] // [A, B]
  playerNames: Record<string, string>
  category: CategoryId | null
  questionIds: string[]
  status: MatchStatus
  results: Record<string, MatchResult>
  winnerId: string | null
  createdAt: number
  expiresAt: number
  /** marca partidas locais contra o bot (fallback offline). */
  isBot?: boolean
}

/** matches/{id}/submissions/{uid} — privado, read só do próprio uid. */
export interface MatchSubmission {
  answers: number[]
  correct: number
  timeMs: number
  submittedAt: number
}

/** reports/{questionId}_{uid} — id determinístico contra flooding (revisão). */
export interface QuestionReport {
  questionId: string
  uid: string
  reason: 'errada' | 'ambigua' | 'segunda_resposta' | 'ofensiva' | 'outro'
  comment?: string
  createdAt: number
  status: 'aberto' | 'em_curadoria' | 'resolvido' | 'rejeitado'
}
