import type { CategoryFile, CategoryId, Question, QuestionsManifest } from '@/types/question'

/**
 * Loader de perguntas (Seção 3/4 do PRD).
 *
 * Estratégia:
 *  - Em produção, o manifest e os JSONs por categoria vivem no Firebase Storage
 *    (versionados). O device baixa, valida checksum e cacheia no Capacitor
 *    Filesystem (NÃO localStorage — recomendação da revisão), com delta updates
 *    baseados no `version` por categoria do manifest.
 *  - No Sprint 0 / web, servimos do bundle estático em /public/questions.
 *
 * Este módulo é o esqueleto: hoje busca do bundle local (fetch). Os TODOs
 * marcam onde entram Storage + cache nativo no Sprint 1.
 */

const QUESTIONS_BASE = '/questions'

const manifestCache: { value: QuestionsManifest | null } = { value: null }
const categoryCache = new Map<CategoryId, Question[]>()

export async function loadManifest(): Promise<QuestionsManifest> {
  if (manifestCache.value) return manifestCache.value
  // TODO(Sprint 1): baixar do Storage + cache no Filesystem com fallback ao bundle.
  const res = await fetch(`${QUESTIONS_BASE}/manifest.json`)
  if (!res.ok) throw new Error(`Falha ao carregar manifest: ${res.status}`)
  const manifest = (await res.json()) as QuestionsManifest
  manifestCache.value = manifest
  return manifest
}

export async function loadCategory(categoryId: CategoryId): Promise<Question[]> {
  const cached = categoryCache.get(categoryId)
  if (cached) return cached

  const manifest = await loadManifest()
  const entry = manifest.categories.find((c) => c.id === categoryId)
  if (!entry) throw new Error(`Categoria desconhecida no manifest: ${categoryId}`)

  // TODO(Sprint 1): checar versão cacheada vs manifest; validar entry.sha256.
  const res = await fetch(`${QUESTIONS_BASE}/${entry.file}`)
  if (!res.ok) throw new Error(`Falha ao carregar categoria ${categoryId}: ${res.status}`)
  const file = (await res.json()) as CategoryFile
  categoryCache.set(categoryId, file.questions)
  return file.questions
}

/** Embaralha (Fisher-Yates) sem mutar o array original. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const pool = [...arr]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

/** Sorteia N perguntas distintas de uma categoria (modo Normal solo). */
export async function drawQuestions(
  categoryId: CategoryId,
  count: number,
  rng: () => number = Math.random,
): Promise<Question[]> {
  const all = await loadCategory(categoryId)
  return shuffle(all, rng).slice(0, Math.min(count, all.length))
}

/** Carrega e mescla várias categorias (modo Challenge mistura categorias). */
export async function loadCategories(ids: CategoryId[]): Promise<Question[]> {
  const lists = await Promise.all(ids.map((id) => loadCategory(id)))
  return lists.flat()
}

/** Resolve perguntas por id (na ordem dada) entre as categorias informadas. */
export async function getQuestionsByIds(ids: string[], from: CategoryId[]): Promise<Question[]> {
  const all = await loadCategories(from)
  const byId = new Map(all.map((q) => [q.id, q]))
  return ids.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q))
}

export function clearQuestionsCache(): void {
  manifestCache.value = null
  categoryCache.clear()
}
