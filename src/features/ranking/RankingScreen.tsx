import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRanking, type RankingScope } from '@/lib/rankingRepo'
import { isFirebaseConfigured } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { weekId } from '@/lib/weekId'
import type { RankingEntry } from '@/types/models'

type Tab = 'global' | 'semanal' | 'normal' | 'stop' | 'challenge'

const TABS: { id: Tab; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'normal', label: 'Normal' },
  { id: 'stop', label: 'Stop' },
  { id: 'challenge', label: 'Challenge' },
]

function scopeFor(tab: Tab): RankingScope {
  return tab === 'semanal' ? (`weekly_${weekId()}` as RankingScope) : tab
}

export function RankingScreen() {
  const [tab, setTab] = useState<Tab>('global')
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const user = useAuthStore((s) => s.user)
  const bests = useProfileStore((s) => s.profile.bests)

  // O ranking exige login (regras do Firestore). Sem conta, nem consultamos.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setEntries([])
      setLoading(false)
      setError(null)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchRanking(scopeFor(tab))
      .then((e) => {
        if (active) setEntries(e)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o ranking. Tente de novo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [tab, user])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-brand-700">Ranking</h1>

      <Link to="/ligas" className="card flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-800 text-white">
        <span className="font-bold">🏆 Brasileirão de Quiz</span>
        <span className="text-sm text-brand-100">Sua liga →</span>
      </Link>

      {/* Suas marcas locais — sempre visíveis. */}
      <div className="card flex justify-around text-center">
        <div>
          <p className="text-xs text-gray-500">Recorde Stop</p>
          <p className="text-xl font-bold text-brand-700">{bests.stop}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Challenge</p>
          <p className="text-xl font-bold text-brand-700">Nível {bests.challengeLevel}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 ring-1 ring-black/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!isFirebaseConfigured || !user ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl">🏆</span>
          <p className="font-medium text-gray-600">Entre para competir</p>
          <p className="text-sm text-gray-500">Crie uma conta para aparecer no ranking e comparar sua pontuação com a galera.</p>
          {isFirebaseConfigured && (
            <Link to="/login" className="btn-primary mt-1 w-full text-center">
              Entrar
            </Link>
          )}
        </div>
      ) : loading ? (
        <div className="card py-10 text-center text-gray-500">Carregando…</div>
      ) : error ? (
        <div className="card py-10 text-center text-sm text-red-500">{error}</div>
      ) : entries.length > 0 ? (
        <div className="card flex flex-col divide-y divide-black/5">
          {entries.map((e, i) => (
            <div key={e.uid} className="flex items-center gap-3 py-2">
              <span className="w-6 text-center font-bold text-gray-500">{i + 1}</span>
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-100 text-sm">
                {e.photoURL ? <img src={e.photoURL} alt="" className="h-9 w-9 object-cover" /> : '👤'}
              </div>
              <span className="w-0 flex-1 truncate text-gray-800">{e.displayName}</span>
              <span className="font-bold text-brand-600">{e.score}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 py-12 text-center text-gray-500">
          <span className="text-4xl">🏆</span>
          <p className="font-medium text-gray-600">Ranking {tab}</p>
          <p className="text-sm">Ainda sem jogadores por aqui. Jogue uma partida e seja o primeiro!</p>
        </div>
      )}
    </div>
  )
}
