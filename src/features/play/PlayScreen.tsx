import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNormalGame } from './useNormalGame'
import { ReportButton } from './ReportButton'
import { getCategoryMeta, PLAYABLE_CATEGORIES } from '@/lib/categories'

export function PlayScreen() {
  const game = useNormalGame()

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Modo Normal</h1>
        <Link to="/" className="text-sm text-gray-400">
          Sair
        </Link>
      </header>

      {(game.phase === 'idle' || game.phase === 'error') && (
        <div className="flex flex-col gap-4">
          {game.phase === 'error' && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{game.error}</p>
          )}
          <p className="text-sm text-gray-500">Escolha uma categoria:</p>
          <div className="grid grid-cols-2 gap-3">
            {PLAYABLE_CATEGORIES.map((id) => {
              const meta = getCategoryMeta(id)
              return (
                <button
                  key={id}
                  onClick={() => game.start(id)}
                  className="card flex h-28 flex-col items-start justify-between text-left active:scale-[0.98]"
                >
                  <span className="text-3xl">{meta.emoji}</span>
                  <span className="font-bold text-gray-800">{meta.nome}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {game.phase === 'loading' && (
        <div className="flex flex-1 items-center justify-center text-gray-400">Carregando…</div>
      )}

      {game.phase === 'playing' && game.question && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${((game.index + 1) / game.total) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-400">
              {game.index + 1}/{game.total}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={game.question.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="flex flex-col gap-4"
            >
              <div className="card">
                <p className="text-xs uppercase tracking-wide text-gray-400">{game.question.difficulty}</p>
                <p className="mt-1 text-lg font-semibold text-gray-800">{game.question.question}</p>
              </div>

              <div className="flex flex-col gap-2">
                {game.question.options.map((opt, i) => {
                  const answered = game.picked !== null
                  const isCorrect = i === game.question!.answerIndex
                  const isPicked = i === game.picked
                  let style = 'bg-white text-gray-800 ring-1 ring-black/5'
                  if (answered && isCorrect) style = 'bg-green-500 text-white'
                  else if (answered && isPicked) style = 'bg-red-500 text-white'
                  else if (answered) style = 'bg-white text-gray-400 ring-1 ring-black/5'
                  return (
                    <button
                      key={i}
                      disabled={answered}
                      onClick={() => game.pick(i)}
                      className={`rounded-2xl px-4 py-3 text-left font-medium transition active:scale-[0.99] ${style}`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>

              {game.picked !== null && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                  {game.question.explanation && (
                    <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{game.question.explanation}</p>
                  )}
                  <button className="btn-primary" onClick={game.next}>
                    {game.index + 1 < game.total ? 'Próxima' : 'Ver resultado'}
                  </button>
                  <ReportButton questionId={game.question.id} />
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {game.phase === 'result' && game.summary && (
        <ResultView summary={game.summary} onAgain={() => game.start(game.summary!.category)} onHome={game.reset} />
      )}
    </div>
  )
}

function ResultView({
  summary,
  onAgain,
  onHome,
}: {
  summary: { correct: number; total: number; points: number }
  onAgain: () => void
  onHome: () => void
}) {
  const pct = Math.round((summary.correct / summary.total) * 100)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
    >
      <span className="text-6xl">{pct >= 70 ? '🎉' : pct >= 40 ? '👏' : '💪'}</span>
      <div>
        <p className="text-5xl font-extrabold text-brand-700">
          {summary.correct}/{summary.total}
        </p>
        <p className="mt-1 text-gray-500">{pct}% de acerto</p>
      </div>
      <div className="card w-full">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Pontos ganhos</span>
          <span className="text-xl font-bold text-brand-600">+{summary.points}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-gray-500">XP</span>
          <span className="font-semibold text-gray-700">+{summary.points}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        <button className="btn-primary" onClick={onAgain}>
          Jogar de novo
        </button>
        <button className="btn-ghost bg-black/5 text-gray-600 hover:bg-black/10" onClick={onHome}>
          Trocar categoria
        </button>
      </div>
    </motion.div>
  )
}
