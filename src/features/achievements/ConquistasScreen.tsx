import { Link } from 'react-router-dom'
import { useProfileStore } from '@/stores/profileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { levelProgress } from '@/lib/leveling'
import type { AchievementContext } from '@/lib/achievements'

export function ConquistasScreen() {
  const profile = useProfileStore((s) => s.profile)
  const ctx: AchievementContext = {
    level: levelProgress(profile.xp).level,
    gamesPlayed: profile.stats.gamesPlayed,
    totalCorrect: profile.stats.totalCorrect,
    streakLongest: profile.streak.longest,
    bestStop: profile.bests.stop,
    bestChallengeLevel: profile.bests.challengeLevel,
    statsByCategory: profile.statsByCategory,
  }
  const unlocked = new Set(profile.achievements)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Conquistas</h1>
        <Link to="/perfil" className="text-sm text-gray-500">
          Perfil
        </Link>
      </header>

      <p className="text-sm text-gray-500">
        {unlocked.size} de {ACHIEVEMENTS.length} desbloqueadas
      </p>

      <div className="flex flex-col gap-3">
        {ACHIEVEMENTS.map((a) => {
          const { current, target } = a.progress(ctx)
          const done = unlocked.has(a.id)
          const pct = Math.min(100, Math.round((current / target) * 100))
          return (
            <div key={a.id} className={`card flex items-center gap-3 ${done ? '' : 'opacity-70'}`}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${done ? 'bg-brand-100' : 'bg-black/5 grayscale'}`}>
                {a.emoji}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-800">{a.title}</p>
                  {done && <span className="text-xs font-bold text-green-600">✓</span>}
                </div>
                <p className="text-xs text-gray-500">{a.desc}</p>
                {!done && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                      <div className="h-full bg-brand-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {Math.min(current, target)}/{target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
