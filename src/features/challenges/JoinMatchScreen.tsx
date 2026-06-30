import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMatchStore } from '@/stores/matchStore'
import { useAuthStore } from '@/stores/authStore'

/** Entrada num desafio aberto via link (/entrar/:matchId). */
export function JoinMatchScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const join = useMatchStore((s) => s.joinOpenMatch)
  const online = useMatchStore((s) => s.online)
  const user = useAuthStore((s) => s.user)
  const [error, setError] = useState<string | null>(null)
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current || !matchId) return
    if (!online || !user) return // espera login
    tried.current = true
    join(matchId)
      .then(() => navigate(`/desafios/${matchId}`, { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível entrar'))
  }, [matchId, online, user, join, navigate])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="text-5xl">⚔️</span>
      {!user ? (
        <>
          <p className="text-gray-600">Entre com sua conta para aceitar o desafio.</p>
          <Link to="/login" className="btn-primary">
            Entrar
          </Link>
        </>
      ) : error ? (
        <>
          <p className="text-red-600">{error}</p>
          <Link to="/desafios" className="text-brand-600">
            Ver meus desafios
          </Link>
        </>
      ) : (
        <p className="text-gray-500">Entrando no desafio…</p>
      )}
    </div>
  )
}
