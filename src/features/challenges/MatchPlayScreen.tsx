import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMatchStore } from '@/stores/matchStore'
import { auth } from '@/lib/firebase'
import type { Match } from '@/types/models'
import type { Question } from '@/types/question'

function meUid() {
  return auth?.currentUser?.uid ?? 'me'
}

export function MatchPlayScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { matches, loaded, load, resolveQuestions, submitTurn } = useMatchStore()

  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<Match | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  const match = matches.find((m) => m.id === matchId)

  // Partida já finalizada → mostra resultado direto.
  useEffect(() => {
    if (match && match.status === 'FINISHED') setResult(match)
  }, [match])

  // Carrega perguntas para jogar o turno.
  useEffect(() => {
    if (match && match.status === 'WAITING' && !questions && matchId) {
      resolveQuestions(matchId).then((qs) => {
        setQuestions(qs)
        startRef.current = Date.now()
      })
    }
  }, [match, questions, matchId, resolveQuestions])

  if (!loaded) return <div className="p-6 text-center text-gray-400">Carregando…</div>
  if (!match) return <NotFound />

  if (result) return <ResultView match={result} navigate={navigate} />

  if (!questions) return <div className="p-6 text-center text-gray-400">Preparando desafio…</div>

  const q = questions[index]
  const picked = answers[index]

  function pick(i: number) {
    if (picked !== undefined) return
    setAnswers((a) => {
      const copy = [...a]
      copy[index] = i
      return copy
    })
  }

  async function next() {
    if (index + 1 < questions!.length) {
      setIndex((n) => n + 1)
      return
    }
    const timeMs = Date.now() - startRef.current
    const filled = questions!.map((_, i) => (answers[i] ?? -1))
    const finished = await submitTurn(matchId!, filled, timeMs)
    setResult(finished)
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-700">Seu turno</h1>
        <span className="text-xs text-gray-400">
          {index + 1}/{questions.length}
        </span>
      </header>

      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="flex flex-col gap-4">
          <div className="card">
            <p className="text-lg font-semibold text-gray-800">{q.question}</p>
          </div>
          <div className="flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className={`rounded-2xl px-4 py-3 text-left font-medium transition ${
                  picked === i ? 'bg-brand-600 text-white' : 'bg-white text-gray-800 ring-1 ring-black/5'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {picked !== undefined && (
            <button className="btn-primary" onClick={next}>
              {index + 1 < questions.length ? 'Próxima' : 'Enviar respostas'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Em modos competitivos não revelamos o gabarito durante a partida (B1). */}
      <p className="text-center text-xs text-gray-300">O resultado aparece quando os dois jogadores terminam.</p>
    </div>
  )
}

function ResultView({ match, navigate }: { match: Match; navigate: (to: string) => void }) {
  const me = meUid()
  const opp = match.players.find((p) => p !== me) ?? '?'
  const myRes = match.results[me]
  const oppRes = match.results[opp]
  const outcome = match.winnerId === me ? 'win' : match.winnerId === null ? 'tie' : 'loss'

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <span className="text-6xl">{outcome === 'win' ? '🏆' : outcome === 'tie' ? '🤝' : '😅'}</span>
      <p className="text-3xl font-extrabold text-brand-700">
        {outcome === 'win' ? 'Você venceu!' : outcome === 'tie' ? 'Empate!' : 'Você perdeu'}
      </p>
      <div className="card flex w-full justify-around">
        <Score name={match.playerNames[me] ?? 'Você'} res={myRes} highlight={outcome === 'win'} />
        <span className="self-center text-gray-300">×</span>
        <Score name={match.playerNames[opp] ?? 'Oponente'} res={oppRes} highlight={outcome === 'loss'} />
      </div>
      <div className="flex w-full flex-col gap-2">
        <button className="btn-primary" onClick={() => navigate('/desafios')}>
          Voltar aos desafios
        </button>
        <Link to="/" className="btn-ghost bg-black/5 text-gray-600 hover:bg-black/10">
          Início
        </Link>
      </div>
    </motion.div>
  )
}

function Score({ name, res, highlight }: { name: string; res?: { correct: number; total: number }; highlight: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="max-w-[7rem] truncate text-sm text-gray-500">{name}</span>
      <span className={`text-3xl font-extrabold ${highlight ? 'text-brand-700' : 'text-gray-700'}`}>
        {res ? `${res.correct}/${res.total}` : '—'}
      </span>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 p-10 text-center text-gray-400">
      <span className="text-4xl">🤔</span>
      <p>Desafio não encontrado.</p>
      <Link to="/desafios" className="text-brand-600">
        Voltar
      </Link>
    </div>
  )
}
