import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { useMatchStore } from '@/stores/matchStore'
import { useDailyStore } from '@/stores/dailyStore'
import { Ftue } from '@/features/onboarding/Ftue'
import { AchievementToast } from '@/features/achievements/AchievementToast'

const NAV = [
  { to: '/', label: 'Início', emoji: '🏠', end: true },
  { to: '/ranking', label: 'Ranking', emoji: '🏆', end: false },
  { to: '/perfil', label: 'Perfil', emoji: '👤', end: false },
]

export function AppLayout() {
  const initAuth = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)
  const loadProfile = useProfileStore((s) => s.load)
  const profileLoaded = useProfileStore((s) => s.loaded)
  const ftueDone = useProfileStore((s) => s.profile.ftueDone)
  const initMatches = useMatchStore((s) => s.init)
  const loadDaily = useDailyStore((s) => s.load)

  useEffect(() => {
    const unsub = initAuth()
    loadProfile()
    loadDaily()
    return unsub
  }, [initAuth, loadProfile, loadDaily])

  // (Re)conecta a fonte de partidas conforme o login (Firestore quando logado).
  useEffect(() => {
    initMatches(user?.uid ?? null)
  }, [user, initMatches])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-gradient-to-b from-brand-50 to-white">
      {profileLoaded && !ftueDone && <Ftue />}
      <AchievementToast />

      <main className="flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-black/5 bg-white/90 backdrop-blur">
        <ul className="flex items-stretch justify-around">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                    isActive ? 'text-brand-600' : 'text-gray-400'
                  }`
                }
              >
                <span className="text-xl">{item.emoji}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
