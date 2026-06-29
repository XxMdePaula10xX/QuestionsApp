import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { drawQuestions } from '@/lib/questionsLoader'
import { getCategoryMeta, SPRINT0_CATEGORIES } from '@/lib/categories'
import { GAME_CONFIG } from '@/lib/gameConfig'
import type { CategoryId, Question } from '@/types/question'

/**
 * DEMO do Sprint 0 — valida o loader de perguntas end-to-end (bundle → tela).
 * NÃO é o modo Normal final (pontuação, XP, validação server-side e ranking
 * entram no Sprint 1/2). Serve para confirmar que o pipeline de dados funciona.
 */
export function PlayScreen() {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(category: CategoryId) {
    setLoading(true)
    setError(null)
    try {
      const qs = await drawQuestions(category, GAME_CONFIG.normalQuestionCount)
      setQuestions(qs)
      setIndex(0)
      setPicked(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
    } finally {
      setLoading(false)
    }
  }

  function next() {
    setPicked(null)
    setIndex((i) => i + 1)
  }

  // Seleção de categoria.
  if (!questions) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <p className="text-sm text-gray-500">
          Demo de carregamento de perguntas (Sprint 0). Escolha uma categoria:
        </p>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {SPRINT0_CATEGORIES.map((id) => {
            const meta = getCategoryMeta(id)
            return (
              <button
                key={id}
                disabled={loading}
                onClick={() => start(id)}
                className={`card flex h-28 flex-col items-start justify-between text-left ${loading ? 'opacity-50' : ''}`}
              >
                <span className="text-3xl">{meta.emoji}</span>
                <span className="font-bold text-gray-800">{meta.nome}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Fim da rodada.
  if (index >= questions.length) {
    return (
      <div className="flex flex-col items-center gap-5 pt-10 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-2xl font-bold text-gray-800">Fim da demo</h2>
        <p className="text-gray-500">{questions.length} perguntas carregadas com sucesso.</p>
        <button className="btn-primary" onClick={() => setQuestions(null)}>
          Jogar de novo
        </button>
        <Link to="/" className="text-sm text-brand-600">
          Voltar ao início
        </Link>
      </div>
    )
  }

  const q = questions[index]
  const answered = picked !== null

  return (
    <div className="flex flex-col gap-5">
      <Header />
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Pergunta {index + 1}/{questions.length}
        </span>
        <span className="capitalize">{q.difficulty}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="flex flex-col gap-4"
        >
          <div className="card">
            <p className="text-lg font-semibold text-gray-800">{q.question}</p>
          </div>

          <div className="flex flex-col gap-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.answerIndex
              const isPicked = i === picked
              let style = 'bg-white text-gray-800 ring-1 ring-black/5'
              if (answered && isCorrect) style = 'bg-green-500 text-white'
              else if (answered && isPicked) style = 'bg-red-500 text-white'
              else if (answered) style = 'bg-white text-gray-400 ring-1 ring-black/5'
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => setPicked(i)}
                  className={`rounded-2xl px-4 py-3 text-left font-medium transition ${style}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {answered && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              {q.explanation && (
                <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{q.explanation}</p>
              )}
              <button className="btn-primary" onClick={next}>
                {index + 1 < questions.length ? 'Próxima' : 'Finalizar'}
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-brand-700">Jogar</h1>
      <Link to="/" className="text-sm text-gray-400">
        Sair
      </Link>
    </header>
  )
}
