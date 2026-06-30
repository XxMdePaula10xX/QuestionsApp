import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useChallengeGame } from './useChallengeGame'
import { challengeDifficultyForLevel } from '@/lib/gameConfig'
import { useProfileStore } from '@/stores/profileStore'

export function ChallengeScreen() {
  const game = useChallengeGame()
  const best = useProfileStore((s) => s.profile.bests.challengeLevel)

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">🪜 Challenge</h1>
        <Link to="/" className="text-sm text-gray-400">
          Sair
        </Link>
      </header>

      {(game.phase === 'idle' || game.phase === 'error') && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          {game.phase === 'error' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{game.error}</p>}
          <span className="text-5xl">🪜</span>
          <p className="text-gray-600">
            {game.totalLevels} níveis de dificuldade crescente. Errou, acabou — mas os checkpoints (níveis{' '}
            {game.checkpoints.join(' e ')}) garantem sua recompensa.
          </p>
          {best > 0 && <p className="text-sm font-semibold text-gray-500">Seu recorde: nível {best}</p>}
          <button className="btn-primary w-full" onClick={() => game.start()}>
            Começar
          </button>
        </div>
      )}

      {game.phase === 'loading' && <div className="flex flex-1 items-center justify-center text-gray-400">Carregando…</div>}

      {game.phase === 'playing' && game.question && (
        <div className="flex flex-col gap-5">
          {/* Escada de níveis. */}
          <div className="flex items-center justify-between gap-1">
            {Array.from({ length: game.totalLevels }, (_, n) => {
              const lvl = n + 1
              const done = lvl < game.level
              const current = lvl === game.level
              const isCheckpoint = game.checkpoints.includes(lvl)
              return (
                <div
                  key={lvl}
                  className={`flex h-7 flex-1 items-center justify-center rounded text-[10px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'bg-brand-600 text-white' : 'bg-black/5 text-gray-400'
                  }`}
                >
                  {isCheckpoint ? '🚩' : lvl}
                </div>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={game.question.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="card">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Nível {game.level} · {challengeDifficultyForLevel(game.level)}
                </p>
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
                  return (
                    <button key={i} disabled={answered} onClick={() => game.pick(i)} className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left font-medium transition ${style}`}>
                      <span>{opt}</span>
                      {answered && isCorrect && <span aria-hidden>✓</span>}
                      {answered && isPicked && !isCorrect && <span aria-hidden>✗</span>}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {game.phase === 'result' && game.summary && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="text-6xl">{game.summary.won ? '🏆' : '🪜'}</span>
          <div>
            <p className="text-3xl font-extrabold text-brand-700">
              {game.summary.won ? 'Você venceu!' : `Nível ${game.summary.completedLevels}`}
            </p>
            <p className="mt-1 text-gray-500">+{game.summary.points} pontos garantidos</p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <button className="btn-primary" onClick={() => game.start()}>
              Tentar de novo
            </button>
            <Link to="/" className="btn-ghost bg-black/5 text-gray-600 hover:bg-black/10">
              Voltar ao início
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
