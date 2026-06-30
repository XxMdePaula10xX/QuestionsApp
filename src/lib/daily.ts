import type { Question } from '@/types/question'
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
 * Escolhe DETERMINISTICAMENTE a pergunta do dia a partir da data — cliente e
 * servidor chegam à mesma pergunta sem precisar coordenar. Prioriza a categoria
 * "Brasil" (caderno cultural diário), com fallback ao catálogo todo.
 */
export function pickDailyQuestion(all: Question[], dateKey: string): Question | null {
  if (all.length === 0) return null
  const h = hashString(dateKey)
  const brasil = all.filter((q) => q.category === 'brasil')
  const pool = brasil.length > 0 && h % 3 !== 0 ? brasil : all
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id)) // ordem estável
  return sorted[h % sorted.length]
}
