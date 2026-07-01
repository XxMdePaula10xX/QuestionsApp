import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMatchStore } from '@/stores/matchStore'
import { useAuthStore } from '@/stores/authStore'
import { getCategoryMeta } from '@/lib/categories'
import { needsMyTurn, isFinished } from '@/lib/matchEngine'
import { listFriends } from '@/lib/friendsRepo'
import type { Friend, Match } from '@/types/models'

function meUid() {
  return useAuthStore.getState().user?.uid ?? 'me'
}

export function ChallengesScreen() {
  const navigate = useNavigate()
  const { matches, loaded, online, createMatch, createOpenMatch } = useMatchStore()
  const user = useAuthStore((s) => s.user)
  const [choosing, setChoosing] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (online && user) listFriends(user.uid).then(setFriends)
  }, [online, user])

  async function start(opponent: string | null | 'bot') {
    setBusy(true)
    setError(null)
    try {
      const id = await createMatch(opponent, null)
      setChoosing(false)
      navigate(`/desafios/${id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar desafio'
      setError(/oponente/i.test(msg) ? 'Ainda não há outros jogadores. Convide um amigo ou crie uma segunda conta para testar.' : msg)
    } finally {
      setBusy(false)
    }
  }

  async function startOpen() {
    setBusy(true)
    setError(null)
    try {
      const id = await createOpenMatch(null)
      setChoosing(false)
      navigate(`/desafios/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar desafio aberto')
    } finally {
      setBusy(false)
    }
  }

  const me = meUid()
  const yourTurn = matches.filter((m) => needsMyTurn(m, me))
  const waiting = matches.filter((m) => !isFinished(m) && !needsMyTurn(m, me))
  const finished = matches.filter(isFinished)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Desafios</h1>
        <Link to="/" className="text-sm text-gray-400">
          Início
        </Link>
      </header>

      {!choosing ? (
        <button className="btn-primary" onClick={() => setChoosing(true)}>
          ⚔️ Novo desafio
        </button>
      ) : (
        <div className="card flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-700">Desafiar…</p>
          {online ? (
            <>
              <button className="rounded-2xl bg-brand-50 px-4 py-3 text-left font-medium text-brand-700" disabled={busy} onClick={() => start(null)}>
                🎲 Oponente aleatório
              </button>
              <button className="rounded-2xl bg-brand-50 px-4 py-3 text-left font-medium text-brand-700" disabled={busy} onClick={startOpen}>
                🔗 Desafio aberto (mandar link no grupo)
              </button>
              {friends.map((f) => (
                <button key={f.uid} className="rounded-2xl bg-black/5 px-4 py-3 text-left font-medium text-gray-700" disabled={busy} onClick={() => start(f.uid)}>
                  {f.displayName} <span className="text-gray-400">@{f.username}</span>
                </button>
              ))}
              {friends.length === 0 && <p className="px-1 text-xs text-gray-400">Adicione amigos no Perfil → Amigos para desafiá-los diretamente.</p>}
            </>
          ) : (
            <button className="rounded-2xl bg-brand-50 px-4 py-3 text-left font-medium text-brand-700" disabled={busy} onClick={() => start('bot')}>
              🤖 Treinar com o Robô Sabido
            </button>
          )}
          <button className="mt-1 text-sm text-gray-400" onClick={() => setChoosing(false)}>
            Cancelar
          </button>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {!loaded && <div className="card py-8 text-center text-gray-400">Carregando…</div>}

      {loaded && matches.length === 0 && !choosing && (
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
      {waiting.length > 0 && (
        <Section title="Aguardando oponente">
          {waiting.map((m) => (
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
  const outcome = m.status === 'FINISHED' ? (m.winnerId === me ? 'win' : m.winnerId === null ? 'tie' : 'loss') : null

  return (
    <Link to={`/desafios/${m.id}`} className="card flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-2xl">{cat?.emoji ?? '⚔️'}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">vs {oppName}</p>
          <p className="truncate text-xs text-gray-400">{cat?.nome ?? 'Categorias variadas'}</p>
        </div>
      </div>
      {needsMyTurn(m, me) ? (
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">Jogar</span>
      ) : m.status === 'EXPIRED' ? (
        <span className="text-sm font-bold text-gray-400">Expirado</span>
      ) : outcome === 'win' ? (
        <span className="text-sm font-bold text-green-600">Vitória 🏆</span>
      ) : outcome === 'tie' ? (
        <span className="text-sm font-bold text-gray-500">Empate</span>
      ) : outcome === 'loss' ? (
        <span className="text-sm font-bold text-red-500">Derrota</span>
      ) : (
        <span className="text-xs text-gray-400">Aguardando…</span>
      )}
    </Link>
  )
}
