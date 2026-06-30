import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMatchStore } from '@/stores/matchStore'
import { getCategoryMeta } from '@/lib/categories'
import { auth } from '@/lib/firebase'
import type { Match } from '@/types/models'

function meUid() {
  return auth?.currentUser?.uid ?? 'me'
}

export function ChallengesScreen() {
  const navigate = useNavigate()
  const { matches, loaded, load, createBotMatch } = useMatchStore()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  async function novoDesafio() {
    setBusy(true)
    try {
      const m = await createBotMatch(null)
      navigate(`/desafios/${m.id}`)
    } finally {
      setBusy(false)
    }
  }

  const me = meUid()
  const yourTurn = matches.filter((m) => m.status === 'WAITING' || m.status === 'A_DONE')
  const finished = matches.filter((m) => m.status === 'FINISHED' || m.status === 'EXPIRED')

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Desafios</h1>
        <Link to="/" className="text-sm text-gray-400">
          Início
        </Link>
      </header>

      <button className="btn-primary" disabled={busy} onClick={novoDesafio}>
        ⚔️ Novo desafio
      </button>

      {matches.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-12 text-center text-gray-400">
          <span className="text-4xl">⚔️</span>
          <p className="text-sm">Nenhum desafio ainda. Crie o primeiro!</p>
        </div>
      )}

      {yourTurn.length > 0 && (
        <Section title="Sua vez">
          {yourTurn.map((m) => (
            <MatchRow key={m.id} m={m} me={me} />
          ))}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Finalizados">
          {finished.map((m) => (
            <MatchRow key={m.id} m={m} me={me} />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      {children}
    </section>
  )
}

function MatchRow({ m, me }: { m: Match; me: string }) {
  const opponent = m.players.find((p) => p !== me) ?? '?'
  const oppName = m.playerNames[opponent] ?? 'Oponente'
  const cat = m.category ? getCategoryMeta(m.category) : null
  const won = m.status === 'FINISHED' ? (m.winnerId === me ? 'win' : m.winnerId === null ? 'tie' : 'loss') : null

  return (
    <Link to={`/desafios/${m.id}`} className="card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat?.emoji ?? '⚔️'}</span>
        <div>
          <p className="font-semibold text-gray-800">vs {oppName}</p>
          <p className="text-xs text-gray-400">{cat?.nome ?? 'Categorias variadas'}</p>
        </div>
      </div>
      {m.status === 'WAITING' ? (
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">Jogar</span>
      ) : won === 'win' ? (
        <span className="text-sm font-bold text-green-600">Vitória 🏆</span>
      ) : won === 'tie' ? (
        <span className="text-sm font-bold text-gray-500">Empate</span>
      ) : (
        <span className="text-sm font-bold text-red-500">Derrota</span>
      )}
    </Link>
  )
}
