import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import { fetchProfile } from '@/lib/userRepo'

/** Divisões do "Brasileirão de Quiz" (ideia #6). 0 = base, 4 = elite. */
const TIERS = [
  { name: 'Várzea', emoji: '⚽', color: 'bg-stone-400' },
  { name: 'Série C', emoji: '🥉', color: 'bg-amber-600' },
  { name: 'Série B', emoji: '🥈', color: 'bg-slate-400' },
  { name: 'Série A', emoji: '🥇', color: 'bg-yellow-400' },
  { name: 'Libertadores', emoji: '🏆', color: 'bg-brand-600' },
]

export function LigasScreen() {
  const user = useAuthStore((s) => s.user)
  const [league, setLeague] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (isFirebaseConfigured && user) {
      fetchProfile(user.uid)
        .then((p) => active && setLeague(p?.league ?? 0))
        .finally(() => active && setLoading(false))
    } else {
      setLeague(0)
      setLoading(false)
    }
    return () => {
      active = false
    }
  }, [user])

  const current = league ?? 0

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">🏆 Ligas</h1>
        <Link to="/ranking" className="text-sm text-gray-400">
          Ranking
        </Link>
      </header>

      <p className="text-sm text-gray-500">
        Todo domingo, os melhores da sua divisão <strong>sobem</strong> e os últimos <strong>caem</strong>. Sua disputa é
        contra jogadores do seu nível — não contra o Brasil inteiro.
      </p>

      {loading ? (
        <div className="card py-8 text-center text-gray-400">Carregando…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {TIERS.map((t, i) => {
            const isCurrent = i === current
            return (
              <div
                key={t.name}
                className={`card flex items-center gap-3 ${isCurrent ? 'ring-2 ring-brand-400' : 'opacity-80'}`}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-2xl text-xl ${t.color} text-white`}>{t.emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{t.name}</p>
                  {isCurrent && <p className="text-xs font-semibold text-brand-600">Você está aqui</p>}
                </div>
                {i === TIERS.length - 1 && <span className="text-xs text-gray-400">elite</span>}
              </div>
            )
          })}
        </div>
      )}

      {!isFirebaseConfigured && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          Entre com uma conta para participar das ligas — a promoção/rebaixamento roda no servidor toda semana.
        </p>
      )}
    </div>
  )
}
