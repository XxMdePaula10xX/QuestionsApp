import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRoomStore } from '@/stores/roomStore'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'

export function RoomScreen() {
  const store = useRoomStore()
  const { code, room, players, questions, picked, error } = store
  const user = useAuthStore((s) => s.user)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => () => store.leave(), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setRunError(null)
    try {
      await fn()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  // Sem sala ainda → criar/entrar.
  if (!code || !room) {
    const canPlay = isFirebaseConfigured && !!user
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <p className="text-sm text-gray-500">Jogue ao vivo com a galera na mesma hora — no boteco, na sala de aula, no grupo.</p>
        {!canPlay ? (
          <div className="card flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-sm text-gray-600">
              {isFirebaseConfigured
                ? 'Entre com sua conta para criar uma sala ou entrar numa.'
                : 'As salas ao vivo ficam disponíveis quando o app está conectado.'}
            </p>
            {isFirebaseConfigured && (
              <Link to="/login" className="btn-primary w-full text-center">
                Entrar
              </Link>
            )}
          </div>
        ) : (
          <>
            <button className="btn-primary" disabled={busy} onClick={() => run(() => store.create(null))}>
              {busy ? 'Criando…' : '🎉 Criar uma sala'}
            </button>
            <div className="card flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-700">Entrar com código</p>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  className="w-0 flex-1 rounded-xl px-3 py-2 text-center text-lg font-bold uppercase tracking-widest ring-1 ring-black/10 outline-none"
                />
                <button className="btn-primary px-4 py-2" disabled={busy || joinCode.length < 4} onClick={() => run(() => store.join(joinCode))}>
                  Entrar
                </button>
              </div>
            </div>
          </>
        )}
        {(runError || error) && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{runError || error}</p>}
      </div>
    )
  }

  // Lobby.
  if (room.status === 'lobby') {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <div className="card text-center">
          <p className="text-sm text-gray-500">Código da sala</p>
          <p className="text-5xl font-extrabold tracking-widest text-brand-700">{room.code}</p>
          <p className="mt-1 text-xs text-gray-400">Compartilhe o código para a galera entrar.</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Na sala ({players.length})</p>
          {players.map((p) => (
            <div key={p.uid} className="card flex items-center gap-2 py-2">
              <span>👤</span>
              <span className="truncate text-gray-800">{p.name}</span>
              {p.uid === room.hostUid && <span className="ml-auto shrink-0 text-xs text-brand-600">anfitrião</span>}
            </div>
          ))}
        </div>
        {store.isHost() ? (
          <button className="btn-primary" disabled={busy} onClick={() => run(store.start)}>
            Começar ({players.length} {players.length === 1 ? 'jogador' : 'jogadores'})
          </button>
        ) : (
          <p className="text-center text-sm text-gray-400">Aguardando o anfitrião começar…</p>
        )}
      </div>
    )
  }

  // Jogando.
  if (room.status === 'playing') {
    const q = questions[room.currentIndex]
    const answeredCount = players.filter((p) => p.answeredIndex >= room.currentIndex).length
    return (
      <div className="flex min-h-[70vh] flex-col gap-5">
        <Header />
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Pergunta {room.currentIndex + 1}/{questions.length}</span>
          <span>{answeredCount}/{players.length} responderam</span>
        </div>
        {q && (
          <>
            <div className="card">
              <p className="text-lg font-semibold text-gray-800">{q.question}</p>
            </div>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                const reveal = picked !== null
                const isCorrect = i === q.answerIndex
                const isPicked = i === picked
                let style = 'bg-white text-gray-800 ring-1 ring-black/5'
                if (reveal && isCorrect) style = 'bg-green-500 text-white'
                else if (reveal && isPicked) style = 'bg-red-500 text-white'
                return (
                  <button key={i} disabled={reveal} onClick={() => store.answer(i)} className={`rounded-2xl px-4 py-3 text-left font-medium transition ${style}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
          </>
        )}
        {store.isHost() && (
          <button className="btn-primary mt-auto" disabled={busy} onClick={() => run(store.next)}>
            {room.currentIndex + 1 >= questions.length ? 'Ver pódio' : 'Próxima pergunta'}
          </button>
        )}
        {!store.isHost() && <p className="mt-auto text-center text-xs text-gray-400">O anfitrião controla o ritmo.</p>}
      </div>
    )
  }

  // Pódio.
  const podium = players.slice(0, 3)
  const medals = ['🥇', '🥈', '🥉']
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <Header />
      <h2 className="text-center text-2xl font-bold text-gray-800">Pódio 🏆</h2>
      <div className="flex flex-col gap-2">
        {podium.map((p, i) => (
          <div key={p.uid} className="card flex items-center gap-3">
            <span className="text-2xl">{medals[i]}</span>
            <span className="w-0 flex-1 truncate font-semibold text-gray-800">{p.name}</span>
            <span className="font-bold text-brand-600">{p.score}</span>
          </div>
        ))}
      </div>
      <Link to="/sala" onClick={() => store.leave()} className="btn-primary text-center">
        Nova sala
      </Link>
    </motion.div>
  )
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-brand-700">🎉 Sala</h1>
      <Link to="/" className="text-sm text-gray-400">
        Sair
      </Link>
    </header>
  )
}
