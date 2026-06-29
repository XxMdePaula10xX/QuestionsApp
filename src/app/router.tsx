import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomeScreen } from '@/features/home/HomeScreen'
import { PlayScreen } from '@/features/play/PlayScreen'
import { RankingScreen } from '@/features/ranking/RankingScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { LoginScreen } from '@/features/auth/LoginScreen'

/**
 * Rotas do MVP (escopo enxuto do Sprint 0):
 * Home, Jogar (Normal), Ranking, Perfil, Login.
 * Modos Stop/Challenge e Desafios entram em sprints seguintes.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'jogar', element: <PlayScreen /> },
      { path: 'jogar/:mode', element: <PlayScreen /> },
      { path: 'ranking', element: <RankingScreen /> },
      { path: 'perfil', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
