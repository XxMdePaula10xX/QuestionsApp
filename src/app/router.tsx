import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomeScreen } from '@/features/home/HomeScreen'
import { PlayScreen } from '@/features/play/PlayScreen'
import { StopScreen } from '@/features/stop/StopScreen'
import { ChallengeScreen } from '@/features/challenge/ChallengeScreen'
import { RankingScreen } from '@/features/ranking/RankingScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { ChallengesScreen } from '@/features/challenges/ChallengesScreen'
import { MatchPlayScreen } from '@/features/challenges/MatchPlayScreen'
import { JoinMatchScreen } from '@/features/challenges/JoinMatchScreen'
import { FriendsScreen } from '@/features/friends/FriendsScreen'
import { ConquistasScreen } from '@/features/achievements/ConquistasScreen'
import { LigasScreen } from '@/features/leagues/LigasScreen'
import { RoomScreen } from '@/features/room/RoomScreen'
import { DailyScreen } from '@/features/daily/DailyScreen'
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
      { path: 'jogar/normal', element: <PlayScreen /> },
      { path: 'jogar/stop', element: <StopScreen /> },
      { path: 'jogar/challenge', element: <ChallengeScreen /> },
      { path: 'desafios', element: <ChallengesScreen /> },
      { path: 'desafios/:matchId', element: <MatchPlayScreen /> },
      { path: 'entrar/:matchId', element: <JoinMatchScreen /> },
      { path: 'amigos', element: <FriendsScreen /> },
      { path: 'conquistas', element: <ConquistasScreen /> },
      { path: 'ligas', element: <LigasScreen /> },
      { path: 'sala', element: <RoomScreen /> },
      { path: 'diaria', element: <DailyScreen /> },
      { path: 'ranking', element: <RankingScreen /> },
      { path: 'perfil', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
