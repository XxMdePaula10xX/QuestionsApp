import { getBytes, ref } from 'firebase/storage'
import { storage, isFirebaseConfigured } from '@/lib/firebase'
import { cacheRead, cacheWrite } from '@/lib/questionsCache'
import type { CategoryFile, CategoryId, Question, QuestionsManifest } from '@/types/question'

/**
 * Loader de perguntas (Seção 3/4 do PRD; Sprint 4 = caminho de produção).
 *
 * Ordem de resolução por categoria:
 *  1. Cache no device (Capacitor Filesystem) se a versão bate com o manifest
 *     → delta update: só rebaixa quando muda a versão.
 *  2. Download do Firebase Storage (quando configurado) → grava no cache.
 *  3. Fallback ao bundle estático em /public/questions (dev/offline/1ª carga).
 */

const BUNDLE_BASE = '/questions'

const manifestCache: { value: QuestionsManifest | null } = { value: null }
const categoryCache = new Map<CategoryId, Question[]>()

async function fetchBundle<T>(file: string): Promise<T> {
  const res = await fetch(`${BUNDLE_BASE}/${file}`)
  if (!res.ok) throw new Error(`Falha ao carregar ${file}: ${res.status}`)
  return (await res.json()) as T
}

async function fetchFromStorage<T>(file: string): Promise<T | null> {
  if (!isFirebaseConfigured || !storage) return null
  try {
    const bytes = await getBytes(ref(storage, `questions/${file}`))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null // sem permissão/offline → cai no bundle
  }
}

export async function loadManifest(): Promise<QuestionsManifest> {
  if (manifestCache.value) return manifestCache.value
  const fromStorage = await fetchFromStorage<QuestionsManifest>('manifest.json')
  const manifest = fromStorage ?? (await fetchBundle<QuestionsManifest>('manifest.json'))
  if (fromStorage) await cacheWrite('manifest.json', manifest)
  manifestCache.value = manifest
  return manifest
}

export async function loadCategory(categoryId: CategoryId): Promise<Question[]> {
  const mem = categoryCache.get(categoryId)
  if (mem) return mem

  const manifest = await loadManifest()
  const entry = manifest.categories.find((c) => c.id === categoryId)
  if (!entry) throw new Error(`Categoria desconhecida no manifest: ${categoryId}`)

  // 1. Cache local, válido se a versão bate (delta update).
  const cached = await cacheRead<CategoryFile>(entry.file)
  if (cached && cached.version === entry.version) {
    categoryCache.set(categoryId, cached.questions)
    return cached.questions
  }

  // 2. Storage → grava no cache. 3. Fallback bundle.
  const fromStorage = await fetchFromStorage<CategoryFile>(entry.file)
  const file = fromStorage ?? (await fetchBundle<CategoryFile>(entry.file))
  if (fromStorage) await cacheWrite(entry.file, file)

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
