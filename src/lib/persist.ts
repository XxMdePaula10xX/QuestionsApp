import { Preferences } from '@capacitor/preferences'

/**
 * Persistência local key-value (perfil/streak/FTUE/seen/conquistas).
 *
 * Usa @capacitor/preferences — no nativo (iOS/Android) grava em armazenamento
 * durável (UserDefaults/SharedPreferences), evitando a perda de progresso que o
 * localStorage sofre no WKWebView do iOS sob pressão de armazenamento. Na web,
 * o plugin já cai em localStorage automaticamente.
 */
const PREFIX = 'sabido:'

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key: PREFIX + key })
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await Preferences.set({ key: PREFIX + key, value: JSON.stringify(value) })
  } catch {
    /* quota/sandbox — ignora silenciosamente */
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await Preferences.remove({ key: PREFIX + key })
  } catch {
    /* noop */
  }
}
