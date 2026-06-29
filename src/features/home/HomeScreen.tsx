import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { levelProgress } from '@/lib/leveling'

interface ModeCard {
  to: string
  title: string
  desc: string
  emoji: string
  available: boolean
}

const MODES: ModeCard[] = [
  { to: '/jogar/normal', title: 'Normal', desc: 'Partida clássica, sem pressão', emoji: '🎯', available: true },
  { to: '/jogar/stop', title: 'Stop', desc: 'Contra o tempo', emoji: '⏱️', available: true },
  { to: '/jogar/challenge', title: 'Challenge', desc: 'Escada de dificuldade', emoji: '🪜', available: true },
  { to: '/jogar/desafio', title: 'Desafio', desc: 'Contra um amigo', emoji: '⚔️', available: false },
]

export function HomeScreen() {
  const user = useAuthStore((s) => s.user)
  const profile = useProfileStore((s) => s.profile)
  const streak = useProfileStore((s) => s.currentStreak())
  const prog = levelProgress(profile.xp)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Olá{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋</p>
          <h1 className="text-3xl font-extrabold text-brand-700">Sabido</h1>
        </div>
        <Link to="/perfil" className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-lg">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full object-cover" /> : '👤'}
        </Link>
      </header>

      {/* Nível + XP + streak (motor de retenção). */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-800">Nível {prog.level}</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-orange-500">
            🔥 {streak} {streak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/5">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
        </div>
        <span className="text-xs text-gray-400">
          {prog.intoLevel}/{prog.span} XP para o nível {prog.level + 1}
        </span>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Modos de jogo</h2>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m, i) => (
            <motion.div key={m.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {m.available ? (
                <Link to={m.to} className="card flex h-32 flex-col justify-between active:scale-[0.98]">
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
