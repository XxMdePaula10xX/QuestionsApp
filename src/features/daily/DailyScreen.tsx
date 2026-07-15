import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDailyStore } from '@/stores/dailyStore'

export function DailyScreen() {
  const { loaded, question, answeredToday, picked, pctCorrect, answer } = useDailyStore()

  if (!loaded || !question) {
    return <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Carregando…</div>
  }

  const revealed = answeredToday && picked !== null

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">⭐ Pergunta do Dia</h1>
        <Link to="/" className="text-sm text-gray-500">
          Início
        </Link>
      </header>
      <p className="text-sm text-gray-500">Uma pergunta nova por dia, a mesma para o Brasil inteiro.</p>

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-gray-500">{question.category}</p>
        <p className="mt-1 text-lg font-semibold text-gray-800">{question.question}</p>
      </div>

      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.answerIndex
          const isPicked = i === picked
          let style = 'bg-white text-gray-800 ring-1 ring-black/5'
          if (revealed && isCorrect) style = 'bg-green-500 text-white'
          else if (revealed && isPicked) style = 'bg-red-500 text-white'
          else if (revealed) style = 'bg-white text-gray-500 ring-1 ring-black/5'
          return (
            <button key={i} disabled={revealed} onClick={() => answer(i)} className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left font-medium transition ${style}`}>
              <span>{opt}</span>
              {revealed && isCorrect && <span aria-hidden>✓</span>}
              {revealed && isPicked && !isCorrect && <span aria-hidden>✗</span>}
            </button>
          )
        })}
      </div>

      {revealed && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          {question.explanation && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{question.explanation}</p>}
          {pctCorrect !== null ? (
            <p className="text-center text-sm font-semibold text-gray-600">
              🇧🇷 {pctCorrect}% do Brasil acertou esta pergunta.
            </p>
          ) : (
            <p className="text-center text-xs text-gray-500">Volte amanhã para a próxima pergunta do dia!</p>
          )}
          <Link to="/" className="btn-primary text-center">
            Voltar ao início
          </Link>
        </motion.div>
      )}
    </div>
  )
}
