import { useState } from 'react'

type Tab = 'global' | 'semanal' | 'modo' | 'amigos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'modo', label: 'Por modo' },
  { id: 'amigos', label: 'Amigos' },
]

export function RankingScreen() {
  const [tab, setTab] = useState<Tab>('global')

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-brand-700">Ranking</h1>

      <div className="flex gap-2 overflow-x-auto">
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

      {/* Placeholder — entries virão de rankings/{scope}/entries no Sprint 2. */}
      <div className="card flex flex-col items-center gap-2 py-12 text-center text-gray-400">
        <span className="text-4xl">🏆</span>
        <p className="font-medium text-gray-600">Ranking {tab}</p>
        <p className="text-sm">Disponível a partir do Sprint 2.</p>
      </div>
    </div>
  )
}
