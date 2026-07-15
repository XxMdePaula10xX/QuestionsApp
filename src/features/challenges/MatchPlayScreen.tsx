import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMatchStore } from '@/stores/matchStore'
import { useAuthStore } from '@/stores/authStore'
import { needsMyTurn, isFinished } from '@/lib/matchEngine'
import type { Match } from '@/types/models'
import type { Question } from '@/types/question'

function meUid() {
  return useAuthStore.getState().user?.uid ?? 'me'
}

export function MatchPlayScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { matches, loaded, resolveQuestions, submitTurn } = useMatchStore()

  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const startRef = useRef<number>(0)

  const match = matches.find((m) => m.id === matchId)
  const me = meUid()
  const myTurn = match ? needsMyTurn(match, me) : false

  // Carrega perguntas quando é a vez do jogador.
  useEffect(() => {
    if (match && myTurn && !questions && matchId) {
      resolveQuestions(matchId).then((qs) => {
        setQuestions(qs)
        startRef.current = Date.now()
      })
    }
  }, [match, myTurn, questions, matchId, resolveQuestions])

  if (!loaded) return <Centered>Carregando…</Centered>
  if (!match) return <NotFound />

  // Encerrada → resultado.
  if (isFinished(match)) return <ResultView match={match} navigate={navigate} />
  // Já joguei e aguardo o oponente.
  if (submitted || !myTurn) return <WaitingView match={match} me={me} />
  if (!questions) return <Centered>Preparando desafio…</Centered>

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
    if (submitting) return
    const timeMs = Date.now() - startRef.current
    const filled = questions!.map((_, i) => answers[i] ?? -1)
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Só marca como enviado APÓS o sucesso — antes, uma falha de rede mostrava
      // "Respostas enviadas!" e descartava a jogada silenciosamente (P1.9).
      await submitTurn(matchId!, filled, timeMs)
      setSubmitted(true)
    } catch {
      setSubmitError('Não foi possível enviar suas respostas. Verifique a conexão e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-700">Seu turno</h1>
        <span className="text-xs text-gray-500">
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
            <button className="btn-primary disabled:opacity-50" onClick={next} disabled={submitting}>
              {submitting ? 'Enviando…' : index + 1 < questions.length ? 'Próxima' : 'Enviar respostas'}
            </button>
          )}
          {submitError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{submitError}</p>}
        </motion.div>
      </AnimatePresence>

      <p className="text-center text-xs text-gray-500">O resultado aparece quando os dois jogadores terminam.</p>
    </div>
  )
}

function WaitingView({ match, me }: { match: Match; me: string }) {
  const opp = match.players.find((p) => p !== me)
  const isOpen = match.open && match.players.length < 2
  const link = `${window.location.origin}/entrar/${match.id}`

  function share() {
    const text = `Te desafiei no Sabido! Bate meu placar: ${link}`
    if (navigator.share) navigator.share({ title: 'Sabido', text, url: link }).catch(() => {})
    else navigator.clipboard?.writeText(link)
  }

  return (
    <Centered>
      <span className="text-5xl">{isOpen ? '🔗' : '⏳'}</span>
      <p className="mt-3 text-lg font-bold text-gray-800">Respostas enviadas!</p>
      {isOpen ? (
        <>
          <p className="mt-1 text-sm text-gray-500">Mande o link no grupo — quem aceitar joga as MESMAS perguntas e tenta te superar.</p>
          <button className="btn-primary mt-6" onClick={share}>
            🔗 Compartilhar desafio
          </button>
          <p className="mt-2 max-w-full truncate text-xs text-gray-500">{link}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          Aguardando {(opp && match.playerNames[opp]) ?? 'o oponente'} jogar. Você será avisado quando terminar.
        </p>
      )}
      <Link to="/desafios" className="mt-6 text-sm text-brand-600">
        Voltar aos desafios
      </Link>
    </Centered>
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
        <span className="self-center text-gray-500">×</span>
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

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70vh] flex-col items-center justify-center gap-1 p-10 text-center">{children}</div>
}

function NotFound() {
  return (
    <Centered>
      <span className="text-4xl">🤔</span>
      <p className="mt-2 text-gray-500">Desafio não encontrado.</p>
      <Link to="/desafios" className="mt-3 text-brand-600">
        Voltar
      </Link>
    </Centered>
  )
}
