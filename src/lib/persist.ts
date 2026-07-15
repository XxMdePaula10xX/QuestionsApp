import { Preferences } from '@capacitor/preferences'

/**
 * Persistência local key-value (perfil/streak/FTUE/seen/conquistas).
 *
 * DUPLO ARMAZENAMENTO por robustez no app nativo (iOS/WKWebView):
 *  - localStorage: gravação SÍNCRONA e imediata — sobrevive mesmo se o app for
 *    encerrado antes de o await do plugin nativo concluir, e sempre reflete a
 *    última gravação.
 *  - @capacitor/preferences: armazenamento DURÁVEL (UserDefaults/SharedPreferences),
 *    não despejado sob pressão de armazenamento como o localStorage do WKWebView.
 *
 * Cada valor é gravado num ENVELOPE {_seq, data} com um contador monotônico. Na
 * leitura, comparamos as duas camadas e escolhemos a de MAIOR _seq (a mais nova):
 *  - app morto antes do flush do Preferences → localStorage (maior _seq) vence;
 *  - localStorage despejado → Preferences (durável) assume;
 *  - uma camada corrompida (parse falha) → usamos a outra.
 * Assim o progresso não se perde por uma das camadas ficar velha, faltando ou
 * corrompida isoladamente (auditoria P0.1 / P0.3 / P1.5).
 */
const PREFIX = 'sabido:'

// Contador monotônico. Date.now() garante ordem entre reinícios; o incremento
// garante ordem estrita entre duas gravações no mesmo milissegundo.
let lastSeq = 0
function nextSeq(): number {
  const now = Date.now()
  lastSeq = now > lastSeq ? now : lastSeq + 1
  return lastSeq
}

interface Parsed<T> {
  seq: number
  data: T
}

/** Interpreta o valor cru: envelope {_seq,data} ou legado (valor puro = seq 0). */
function parse<T>(raw: string | null): Parsed<T> | null {
  if (raw == null) return null
  try {
    const o = JSON.parse(raw) as unknown
    if (o && typeof o === 'object' && '_seq' in o && 'data' in o) {
      const env = o as { _seq: number; data: T }
      return { seq: Number(env._seq) || 0, data: env.data }
    }
    return { seq: 0, data: o as T } // legado (sem envelope) — trata como o mais antigo
  } catch {
    return null // corrompido — ignora esta camada
  }
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    /* quota/sandbox — ignora */
  }
}

/** Leitura SÍNCRONA (só localStorage) — hidrata a UI sem flash de tela zerada. */
export function loadJSONSync<T>(key: string, fallback: T): T {
  const p = parse<T>(lsGet(key))
  return p ? p.data : fallback
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  const ls = parse<T>(lsGet(key))
  let pref: Parsed<T> | null = null
  try {
    const { value } = await Preferences.get({ key: PREFIX + key })
    pref = parse<T>(value ?? null)
  } catch {
    /* plugin indisponível — usa só o localStorage */
  }
  // Escolhe a camada válida MAIS NOVA. Em empate, prefere o localStorage (`ls`),
  // que é sempre >= fresco por ser gravado primeiro e de forma síncrona.
  let best: Parsed<T> | null = null
  for (const c of [ls, pref]) {
    if (c && (best == null || c.seq > best.seq)) best = c
  }
  return best ? best.data : fallback
}

// Serializa as gravações no Preferences por chave, para não aplicarem fora de
// ordem (o localStorage já é ordenado por ser síncrono).
const writeChains = new Map<string, Promise<void>>()

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify({ _seq: nextSeq(), data: value })
  lsSet(key, raw) // espelho síncrono imediato — sempre a versão mais nova
  const prev = writeChains.get(key) ?? Promise.resolve()
  const next = prev
    .catch(() => {})
    .then(() => Preferences.set({ key: PREFIX + key, value: raw }).catch(() => {}))
  writeChains.set(key, next)
  await next
}

export async function remove(key: string): Promise<void> {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* noop */
  }
  try {
    await Preferences.remove({ key: PREFIX + key })
  } catch {
    /* noop */
  }
}
