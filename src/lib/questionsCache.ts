import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

/**
 * Cache de perguntas no dispositivo (Capacitor Filesystem — NÃO localStorage,
 * conforme a revisão). Persiste o JSON baixado do Storage para uso offline e
 * delta updates (só rebaixa quando a versão do manifest muda). Tudo é
 * best-effort: qualquer falha cai no fallback (bundle) sem quebrar o app.
 */
const DIR = Directory.Data
const FOLDER = 'questions-cache'

function path(name: string): string {
  return `${FOLDER}/${name}`
}

export async function cacheRead<T>(name: string): Promise<T | null> {
  try {
    const res = await Filesystem.readFile({ path: path(name), directory: DIR, encoding: Encoding.UTF8 })
    return JSON.parse(res.data as string) as T
  } catch {
    return null
  }
}

export async function cacheWrite(name: string, value: unknown): Promise<void> {
  try {
    await Filesystem.writeFile({
      path: path(name),
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(value),
      recursive: true,
    })
  } catch {
    /* quota/sandbox/web — ignora; o app segue com o bundle */
  }
}
