import { useState } from 'react'
import { motion } from 'framer-motion'
import { useProfileStore } from '@/stores/profileStore'
import { saveJSON } from '@/lib/persist'

/**
 * First-Time User Experience + gate de idade (LGPD, blocker B4).
 * Aparece uma vez (controlado por profile.ftueDone). Para <13 anos exige
 * confirmação de consentimento dos responsáveis (LGPD art. 14).
 */
const CURRENT_YEAR = new Date().getFullYear()
const MIN_AGE_NO_CONSENT = 13

export function Ftue() {
  const completeFtue = useProfileStore((s) => s.completeFtue)
  const [step, setStep] = useState(0)
  const [birthYear, setBirthYear] = useState('')
  const [parentalOk, setParentalOk] = useState(false)

  const year = Number(birthYear)
  const validYear = year >= 1900 && year <= CURRENT_YEAR
  const age = validYear ? CURRENT_YEAR - year : null
  const needsConsent = age !== null && age < MIN_AGE_NO_CONSENT
  const canFinish = validYear && (!needsConsent || parentalOk)

  async function finish() {
    await saveJSON('ageGate', { birthYear: year, verifiedAt: Date.now() })
    await completeFtue()
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-between bg-gradient-to-b from-brand-600 to-brand-800 px-6 py-10 text-white">
      {step === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="text-6xl">🧠</span>
          <h1 className="text-3xl font-extrabold">Bem-vindo ao Sabido!</h1>
          <p className="text-brand-100">
            O quiz brasileiro. Responda perguntas de várias categorias, ganhe XP, suba de nível e mantenha seu
            streak diário.
          </p>
          <button className="btn bg-white text-brand-700" onClick={() => setStep(1)}>
            Começar
          </button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col justify-center gap-5">
          <h2 className="text-2xl font-bold">Antes de jogar</h2>
          <p className="text-brand-100">Em que ano você nasceu?</p>
          <input
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Ex.: 2005"
            className="rounded-2xl px-4 py-3 text-lg text-gray-800 outline-none"
          />
          {needsConsent && (
            <label className="flex items-start gap-2 text-sm text-brand-100">
              <input type="checkbox" checked={parentalOk} onChange={(e) => setParentalOk(e.target.checked)} className="mt-1" />
              <span>Tenho a permissão dos meus pais ou responsáveis para usar o app (LGPD).</span>
            </label>
          )}
          <p className="text-xs text-brand-200">
            Usamos sua faixa etária só para cumprir a LGPD. Veja a Política de Privacidade.
          </p>
          <button className="btn bg-white text-brand-700 disabled:opacity-40" disabled={!canFinish} onClick={finish}>
            Entrar
          </button>
        </motion.div>
      )}
    </div>
  )
}
