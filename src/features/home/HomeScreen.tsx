import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'

interface ModeCard {
  to: string
  title: string
  desc: string
  emoji: string
  available: boolean
}

const MODES: ModeCard[] = [
  { to: '/jogar/normal', title: 'Normal', desc: 'Partida clássica, sem pressão', emoji: '🎯', available: true },
  { to: '/jogar/stop', title: 'Stop', desc: 'Contra o tempo', emoji: '⏱️', available: false },
  { to: '/jogar/challenge', title: 'Challenge', desc: 'Escada de dificuldade', emoji: '🪜', available: false },
  { to: '/jogar/desafio', title: 'Desafio', desc: 'Contra um amigo', emoji: '⚔️', available: false },
]

export function HomeScreen() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Olá{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋</p>
          <h1 className="text-3xl font-extrabold text-brand-700">Sabido</h1>
        </div>
        <Link to="/perfil" className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-lg">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            '👤'
          )}
        </Link>
      </header>

      {/* Mini-card de ranking (Seção 8.2) — placeholder até Sprint 2. */}
      <Link to="/ranking" className="card flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Sua posição</p>
          <p className="text-lg font-bold text-gray-800">Ranking global</p>
        </div>
        <span className="text-brand-600">Ver →</span>
      </Link>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Modos de jogo</h2>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m, i) => (
            <motion.div
              key={m.to}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {m.available ? (
                <Link to={m.to} className="card flex h-32 flex-col justify-between">
                  <span className="text-3xl">{m.emoji}</span>
                  <div>
                    <p className="font-bold text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                </Link>
              ) : (
                <div className="card flex h-32 flex-col justify-between opacity-60">
                  <span className="text-3xl grayscale">{m.emoji}</span>
                  <div>
                    <p className="font-bold text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-400">Em breve</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
