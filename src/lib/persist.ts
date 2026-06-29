/**
 * Persistência local key-value (perfil/streak/FTUE) — funciona offline.
 *
 * Hoje usa localStorage (web + Capacitor WebView). É async de propósito para
 * permitir trocar por @capacitor/preferences depois sem mudar os chamadores.
 */
const PREFIX = 'sabido:'

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* quota/sandbox — ignora silenciosamente */
  }
}

export async function remove(key: string): Promise<void> {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* noop */
  }
}
