import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import { searchByUsername, sendFriendRequest, type FoundUser } from '@/lib/friendsRepo'

/** Abre um convite de amizade por link (/convite/:username). */
export function ConviteScreen() {
  const { username } = useParams()
  const user = useAuthStore((s) => s.user)
  const [found, setFound] = useState<FoundUser | null>(null)
  const [state, setState] = useState<'loading' | 'idle' | 'sent' | 'notfound'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured || !user || !username) return
    searchByUsername(username).then((u) => {
      setFound(u)
      setState(u ? 'idle' : 'notfound')
    })
  }, [username, user])

  async function add() {
    if (!found) return
    setBusy(true)
    try {
      await sendFriendRequest(found.uid)
      setState('sent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">👋</span>
      {!isFirebaseConfigured || !user ? (
        <>
          <p className="text-gray-600">Entre com sua conta para aceitar o convite de @{username}.</p>
          <Link to="/login" className="btn-primary">
            Entrar
          </Link>
        </>
      ) : state === 'loading' ? (
        <p className="text-gray-400">Carregando convite…</p>
      ) : state === 'notfound' ? (
        <>
          <p className="text-gray-600">Usuário @{username} não encontrado.</p>
          <Link to="/amigos" className="text-brand-600">
            Ir para Amigos
          </Link>
        </>
      ) : state === 'sent' ? (
        <>
          <p className="text-lg font-bold text-gray-800">Pedido enviado! 🎉</p>
          <p className="text-sm text-gray-500">Assim que {found?.displayName} aceitar, vocês poderão se desafiar.</p>
          <Link to="/amigos" className="btn-primary">
            Ver amigos
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-gray-800">{found?.displayName}</p>
          <p className="text-sm text-gray-400">@{found?.username}</p>
          <button className="btn-primary" disabled={busy} onClick={add}>
            Adicionar amigo
          </button>
          <Link to="/" className="text-sm text-gray-400">
            Agora não
          </Link>
        </>
      )}
    </div>
  )
}
