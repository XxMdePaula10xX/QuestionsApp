import type { CategoryId } from '@/types/question'

export interface CategoryMeta {
  id: CategoryId
  nome: string
  emoji: string
  /** classe Tailwind de cor (ver tailwind.config.js > colors.cat). */
  color: string
}

/** As 7 categorias do PRD (Seção 4.2). Sprint 0 entrega amostra de 4. */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'geografia', nome: 'Geografia', emoji: '🌍', color: 'bg-cat-geografia' },
  { id: 'historia', nome: 'História', emoji: '📜', color: 'bg-cat-historia' },
  { id: 'ciencias', nome: 'Ciência & Natureza', emoji: '🔬', color: 'bg-cat-ciencias' },
  { id: 'esporte', nome: 'Esporte', emoji: '⚽', color: 'bg-cat-esporte' },
  { id: 'arte', nome: 'Arte & Cultura', emoji: '🎨', color: 'bg-cat-arte' },
  { id: 'entretenimento', nome: 'Entretenimento', emoji: '🎬', color: 'bg-cat-entretenimento' },
  { id: 'brasil', nome: 'Brasil', emoji: '🇧🇷', color: 'bg-cat-brasil' },
]

/** Categorias com conteúdo disponível na amostra do Sprint 0. */
export const SPRINT0_CATEGORIES: CategoryId[] = ['geografia', 'historia', 'ciencias', 'brasil']

export function getCategoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}
