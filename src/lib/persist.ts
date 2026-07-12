import { Preferences } from '@capacitor/preferences'

/**
 * Persistência local key-value (perfil/streak/FTUE/seen/conquistas).
 *
 * DUPLO ARMAZENAMENTO por robustez no app nativo (iOS/WKWebView):
 *  - localStorage: gravação SÍNCRONA e imediata — sobrevive mesmo se o app for
 *    encerrado antes de o await do plugin nativo concluir.
 *  - @capacitor/preferences: armazenamento DURÁVEL (UserDefaults/SharedPreferences),
 *    não despejado sob pressão de armazenamento como o localStorage do WKWebView.
 *
 * Grava nos DOIS; lê do Preferences (durável) e cai no localStorage se faltar.
 * Assim o progresso NUNCA se perde por uma das camadas falhar isoladamente.
 */
const PREFIX = 'sabido:'

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

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  let raw: string | null = null
  try {
    const { value } = await Preferences.get({ key: PREFIX + key })
    raw = value ?? null
  } catch {
    /* plugin indisponível — cai no localStorage */
  }
  if (raw == null) raw = lsGet(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value)
  // Espelho síncrono imediato: garante persistência mesmo se o await abaixo
  // não completar (app encerrado) ou o plugin nativo falhar.
  lsSet(key, raw)
  try {
    await Preferences.set({ key: PREFIX + key, value: raw })
  } catch {
    /* plugin indisponível — o localStorage já guardou */
  }
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
