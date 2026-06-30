import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProfileStore } from '@/stores/profileStore'
import { saveJSON } from '@/lib/persist'

/**
 * First-Time User Experience: mini-tutorial (modos, XP/streak, reporte) +
 * gate de idade (LGPD, blocker B4). Aparece uma vez (profile.ftueDone).
 */
const CURRENT_YEAR = new Date().getFullYear()
const MIN_AGE_NO_CONSENT = 13

interface Slide {
  emoji: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  { emoji: '🧠', title: 'Bem-vindo ao Sabido!', body: 'O quiz brasileiro de perguntas e respostas. Mostre o quanto você sabe sobre tudo — de geografia a novela.' },
  { emoji: '🎮', title: '4 jeitos de jogar', body: 'Normal (sem pressa), Stop (contra o tempo), Challenge (escada de dificuldade) e Desafio (contra amigos, no seu ritmo).' },
  { emoji: '🔥', title: 'Suba de nível e mantenha o foco', body: 'Cada acerto vale XP e sobe seu nível. Jogue todo dia para manter seu streak 🔥 e brigue pelo topo do ranking.' },
  { emoji: '🚩', title: 'Achou algo errado?', body: 'Toque em "Reportar pergunta" durante o jogo. Sua ajuda mantém a qualidade do quiz para todo mundo.' },
]

export function Ftue() {
  const completeFtue = useProfileStore((s) => s.completeFtue)
  const [step, setStep] = useState(0) // 0..SLIDES.length-1 = tutorial; SLIDES.length = gate
  const [birthYear, setBirthYear] = useState('')
  const [parentalOk, setParentalOk] = useState(false)

  const gateStep = SLIDES.length
  const onGate = step === gateStep

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
      <AnimatePresence mode="wait">
        {!onGate ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
          >
            <span className="text-6xl">{SLIDES[step].emoji}</span>
            <h1 className="text-3xl font-extrabold">{SLIDES[step].title}</h1>
            <p className="text-brand-100">{SLIDES[step].body}</p>
          </motion.div>
        ) : (
          <motion.div key="gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col justify-center gap-4">
            <h2 className="text-2xl font-bold">Quase lá!</h2>
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
            <p className="text-xs text-brand-200">Usamos sua faixa etária só para cumprir a LGPD. Veja a Política de Privacidade.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        {/* indicadores de passo */}
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: gateStep + 1 }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>

        {!onGate ? (
          <div className="flex items-center justify-between">
            <button className="text-sm text-brand-200" onClick={() => setStep(gateStep)}>
              Pular
            </button>
            <button className="btn bg-white px-8 text-brand-700" onClick={() => setStep((s) => s + 1)}>
              {step === SLIDES.length - 1 ? 'Continuar' : 'Próximo'}
            </button>
          </div>
        ) : (
          <button className="btn bg-white text-brand-700 disabled:opacity-40" disabled={!canFinish} onClick={finish}>
            Bora jogar!
          </button>
        )}
      </div>
    </div>
  )
}
