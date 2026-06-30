import { getBytes, ref } from 'firebase/storage'
import { doc, getDoc } from 'firebase/firestore'
import { db, storage, isFirebaseConfigured } from '@/lib/firebase'
import { cacheRead, cacheWrite } from '@/lib/questionsCache'
import type { CategoryFile, CategoryId, Question, QuestionsManifest } from '@/types/question'

/**
 * Loader de perguntas (Seção 3/4 do PRD).
 *
 * Princípio: o jogo NUNCA espera a rede. Servimos sempre da fonte mais rápida
 * disponível (cache no device → bundle embutido) e atualizamos do Firebase
 * Storage em SEGUNDO PLANO, para os deltas valerem na próxima partida. Assim
 * uma leitura lenta/bloqueada do Storage jamais trava a tela (bug do Sprint 4).
 */

const BUNDLE_BASE = '/questions'
const STORAGE_TIMEOUT_MS = 5000

const manifestCache: { value: QuestionsManifest | null } = { value: null }
const categoryCache = new Map<CategoryId, Question[]>()

// Perguntas suspensas pela curadoria (#10) — excluídas do pool. Best-effort.
const suspended = new Set<string>()
async function refreshSuspended(): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  try {
    const snap = await getDoc(doc(db, 'curation', '_index'))
    const list = snap.data()?.suspended as string[] | undefined
    list?.forEach((id) => suspended.add(id))
  } catch {
    /* sem permissão/offline — ignora */
  }
}

async function fetchBundle<T>(file: string): Promise<T> {
  const res = await fetch(`${BUNDLE_BASE}/${file}`)
  if (!res.ok) throw new Error(`Falha ao carregar ${file}: ${res.status}`)
  return (await res.json()) as T
}

/** Best-effort: lê do Storage com timeout; nunca lança nem trava. */
async function fetchFromStorage<T>(file: string): Promise<T | null> {
  if (!isFirebaseConfigured || !storage) return null
  try {
    const bytes = await Promise.race<ArrayBuffer | null>([
      getBytes(ref(storage, `questions/${file}`)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), STORAGE_TIMEOUT_MS)),
    ])
    if (!bytes) return null
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

export async function loadManifest(): Promise<QuestionsManifest> {
  if (manifestCache.value) return manifestCache.value
  // Bundle é instantâneo e sempre presente.
  const manifest = await fetchBundle<QuestionsManifest>('manifest.json')
  manifestCache.value = manifest
  // Atualização do Storage em segundo plano (vale na próxima sessão).
  void fetchFromStorage<QuestionsManifest>('manifest.json').then((remote) => {
    if (remote) manifestCache.value = remote
  })
  void refreshSuspended()
  return manifest
}

export async function loadCategory(categoryId: CategoryId): Promise<Question[]> {
  const mem = categoryCache.get(categoryId)
  if (mem) return mem

  const manifest = await loadManifest()
  const entry = manifest.categories.find((c) => c.id === categoryId)
  if (!entry) throw new Error(`Categoria desconhecida no manifest: ${categoryId}`)

  // 1. Cache no device, se a versão bate (delta update).
  const cached = await cacheRead<CategoryFile>(entry.file)
  let questions: Question[]
  if (cached && cached.version === entry.version) {
    questions = cached.questions
  } else {
    // 2. Bundle embutido (instantâneo, sempre disponível).
    const file = await fetchBundle<CategoryFile>(entry.file)
    questions = file.questions
    void cacheWrite(entry.file, file)
  }
  if (suspended.size > 0) questions = questions.filter((q) => !suspended.has(q.id))
  categoryCache.set(categoryId, questions)

  // 3. Refresh do Storage em segundo plano — atualiza o cache p/ a próxima vez.
  void fetchFromStorage<CategoryFile>(entry.file).then((remote) => {
    if (remote && remote.version >= entry.version) {
      categoryCache.set(categoryId, remote.questions)
      void cacheWrite(entry.file, remote)
    }
  })

  return questions
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

/**
 * Prefere itens inéditos (não vistos). Se não houver inéditos suficientes para
 * o necessário, libera o catálogo inteiro (evita travar quando a base esgota).
 */
export function preferUnseen<T extends { id: string }>(
  items: T[],
  exclude: Set<string> | undefined,
  needed: number,
): T[] {
  if (!exclude || exclude.size === 0) return items
  const unseen = items.filter((q) => !exclude.has(q.id))
  return unseen.length >= needed ? unseen : items
}

/** Sorteia N perguntas distintas de uma categoria, priorizando inéditas (#2). */
export async function drawQuestions(
  categoryId: CategoryId,
  count: number,
  opts: { exclude?: Set<string>; rng?: () => number } = {},
): Promise<Question[]> {
  const rng = opts.rng ?? Math.random
  const all = await loadCategory(categoryId)
  const pool = preferUnseen(all, opts.exclude, count)
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length))
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
