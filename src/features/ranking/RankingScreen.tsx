import { useEffect, useState } from 'react'
import { fetchRanking, type RankingScope } from '@/lib/rankingRepo'
import { isFirebaseConfigured } from '@/lib/firebase'
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
  const bests = useProfileStore((s) => s.profile.bests)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchRanking(scopeFor(tab))
      .then((e) => active && setEntries(e))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [tab])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-brand-700">Ranking</h1>

      {/* Suas marcas locais — sempre visíveis. */}
      <div className="card flex justify-around text-center">
        <div>
          <p className="text-xs text-gray-400">Recorde Stop</p>
          <p className="text-xl font-bold text-brand-700">{bests.stop}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Challenge</p>
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

      {loading ? (
        <div className="card py-10 text-center text-gray-400">Carregando…</div>
      ) : entries.length > 0 ? (
        <div className="card flex flex-col divide-y divide-black/5">
          {entries.map((e, i) => (
            <div key={e.uid} className="flex items-center gap-3 py-2">
              <span className="w-6 text-center font-bold text-gray-400">{i + 1}</span>
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-100 text-sm">
                {e.photoURL ? <img src={e.photoURL} alt="" className="h-9 w-9 object-cover" /> : '👤'}
              </div>
              <span className="flex-1 truncate text-gray-800">{e.displayName}</span>
              <span className="font-bold text-brand-600">{e.score}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 py-12 text-center text-gray-400">
          <span className="text-4xl">🏆</span>
          <p className="font-medium text-gray-600">Ranking {tab}</p>
          <p className="text-sm">
            {isFirebaseConfigured ? 'Ainda sem jogadores. Seja o primeiro!' : 'Entre com uma conta para competir no ranking.'}
          </p>
        </div>
      )}
    </div>
  )
}
