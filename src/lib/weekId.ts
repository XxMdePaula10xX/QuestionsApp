/**
 * weekId no formato ISO `YYYY-Www` (ex.: 2026-W27), usado no ranking semanal.
 * Deve ser calculado de forma idêntica no cliente e na Cloud Function.
 * Referência de fuso: America/Sao_Paulo (público BR) — ver revisão.
 */
export function weekId(date: Date = new Date()): string {
  // Cópia em UTC do "dia" para o cálculo ISO (quinta-feira define a semana).
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7 // segunda=1 ... domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
