import type { CategoryId, Question } from '@/types/question'
import { todayKey } from '@/lib/streak'

/** Chave do dia (fuso local) — base do "Pergunta do Dia". */
export function dailyKey(now: Date = new Date()): string {
  return todayKey(now)
}

/** Hash estável de string (FNV-1a) → inteiro positivo. */
function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Escolhe DETERMINISTICAMENTE a categoria do dia (mesma para todos os devices
 * com o mesmo manifest), com viés para "Brasil" (caderno cultural diário).
 * Carregar só 1 categoria evita puxar todo o catálogo no startup.
 */
export function pickDailyCategory(dateKey: string, categories: CategoryId[]): CategoryId {
  const h = hashString(dateKey + ':cat')
  if (h % 3 !== 0 && categories.includes('brasil')) return 'brasil'
  return categories[h % categories.length]
}

/** Escolhe deterministicamente a pergunta do dia dentro de um conjunto. */
export function pickDailyQuestion(questions: Question[], dateKey: string): Question | null {
  if (questions.length === 0) return null
  const sorted = [...questions].sort((a, b) => a.id.localeCompare(b.id)) // ordem estável
  return sorted[hashString(dateKey) % sorted.length]
}
