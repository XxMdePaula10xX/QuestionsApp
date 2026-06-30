import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStopGame } from './useStopGame'
import { getCategoryMeta, PLAYABLE_CATEGORIES } from '@/lib/categories'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { useProfileStore } from '@/stores/profileStore'

export function StopScreen() {
  const game = useStopGame()
  const best = useProfileStore((s) => s.profile.bests.stop)

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">⏱️ Stop</h1>
        <Link to="/" className="text-sm text-gray-400">
          Sair
        </Link>
      </header>

      {(game.phase === 'idle' || game.phase === 'error') && (
        <div className="flex flex-col gap-4">
          {game.phase === 'error' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{game.error}</p>}
          <p className="text-sm text-gray-500">
            Quantas você acerta em {GAME_CONFIG.stopDurationSeconds}s? Erro desconta {GAME_CONFIG.stopWrongPenaltySeconds}s.
            {best > 0 && <span className="font-semibold"> Recorde: {best}.</span>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PLAYABLE_CATEGORIES.map((id) => {
              const meta = getCategoryMeta(id)
              return (
                <button key={id} onClick={() => game.start(id)} className="card flex h-28 flex-col items-start justify-between text-left active:scale-[0.98]">
                  <span className="text-3xl">{meta.emoji}</span>
                  <span className="font-bold text-gray-800">{meta.nome}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {game.phase === 'loading' && <div className="flex flex-1 items-center justify-center text-gray-400">Carregando…</div>}

      {game.phase === 'playing' && game.question && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-extrabold tabular-nums text-brand-700">{game.timeLeft}s</span>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">{game.score} pts</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full bg-orange-400 transition-all duration-200"
              style={{ width: `${(game.timeLeft / GAME_CONFIG.stopDurationSeconds) * 100}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={game.question.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="card">
                <p className="text-lg font-semibold text-gray-800">{game.question.question}</p>
              </div>
              <div className="flex flex-col gap-2">
                {game.question.options.map((opt, i) => {
                  const answered = game.picked !== null
                  const isCorrect = i === game.question!.answerIndex
                  const isPicked = i === game.picked
                  let style = 'bg-white text-gray-800 ring-1 ring-black/5'
                  if (answered && isCorrect) style = 'bg-green-500 text-white'
                  else if (answered && isPicked) style = 'bg-red-500 text-white'
                  return (
                    <button key={i} disabled={answered} onClick={() => game.pick(i)} className={`rounded-2xl px-4 py-3 text-left font-medium transition ${style}`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {game.phase === 'result' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="text-6xl">⏱️</span>
          <div>
            <p className="text-5xl font-extrabold text-brand-700">{game.score}</p>
            <p className="mt-1 text-gray-500">
              {game.correct} acertos · {best > 0 && game.score >= best ? 'novo recorde! 🎉' : `recorde: ${best}`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <button className="btn-primary" onClick={() => game.category && game.start(game.category)}>
              Jogar de novo
            </button>
            <button className="btn-ghost bg-black/5 text-gray-600 hover:bg-black/10" onClick={game.reset}>
              Trocar categoria
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
