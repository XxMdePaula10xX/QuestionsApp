import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  inviteLink,
  listFriendRequests,
  listFriends,
  respondFriendRequest,
  searchByUsername,
  sendFriendRequest,
} from '@/lib/friendsRepo'
import type { Friend, FriendRequest } from '@/types/models'

export function FriendsScreen() {
  const user = useAuthStore((s) => s.user)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [term, setTerm] = useState('')
  const [found, setFound] = useState<{ uid: string; displayName: string; username: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const myUsername = user?.displayName ? user.displayName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'voce'

  useEffect(() => {
    if (!user) return
    listFriends(user.uid).then(setFriends)
    listFriendRequests(user.uid).then(setRequests)
  }, [user])

  async function buscar() {
    setMsg(null)
    setFound(null)
    const r = await searchByUsername(term)
    if (r) setFound(r)
    else setMsg('Ninguém encontrado com esse usuário.')
  }

  async function adicionar(uid: string) {
    try {
      await sendFriendRequest(uid)
      setMsg('Pedido enviado!')
      setFound(null)
      setTerm('')
    } catch {
      setMsg('Não foi possível enviar o pedido.')
    }
  }

  async function responder(fromUid: string, accept: boolean) {
    await respondFriendRequest(fromUid, accept)
    setRequests((rs) => rs.filter((r) => r.fromUid !== fromUid))
    if (accept && user) listFriends(user.uid).then(setFriends)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Amigos</h1>
        <Link to="/perfil" className="text-sm text-gray-400">
          Perfil
        </Link>
      </header>

      {!isFirebaseConfigured && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          Entre com uma conta (Firebase configurado) para adicionar amigos e desafiá-los.
        </p>
      )}

      {/* Convite */}
      <div className="card flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Seu link de convite</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black/5 px-3 py-2 text-xs text-gray-600">{inviteLink(myUsername)}</code>
          <button
            className="btn-primary px-3 py-2 text-sm"
            onClick={() => navigator.clipboard?.writeText(inviteLink(myUsername)).then(() => setMsg('Link copiado!'))}
          >
            Copiar
          </button>
        </div>
      </div>

      {/* Busca por username */}
      <div className="card flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Adicionar por usuário</p>
        <div className="flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="usuario"
            className="flex-1 rounded-xl px-3 py-2 ring-1 ring-black/10 outline-none"
          />
          <button className="btn-primary px-4 py-2 text-sm" onClick={buscar} disabled={!term.trim() || !isFirebaseConfigured}>
            Buscar
          </button>
        </div>
        {found && (
          <div className="flex items-center justify-between rounded-xl bg-brand-50 p-2">
            <span className="text-sm text-gray-700">
              {found.displayName} <span className="text-gray-400">@{found.username}</span>
            </span>
            <button className="btn-primary px-3 py-1 text-xs" onClick={() => adicionar(found.uid)}>
              Adicionar
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>

      {/* Pedidos pendentes */}
      {requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pedidos</h2>
          {requests.map((r) => (
            <div key={r.fromUid} className="card flex items-center justify-between">
              <span className="text-sm text-gray-700">
                {r.fromName} <span className="text-gray-400">@{r.fromUsername}</span>
              </span>
              <div className="flex gap-2">
                <button className="btn-primary px-3 py-1 text-xs" onClick={() => responder(r.fromUid, true)}>
                  Aceitar
                </button>
                <button className="rounded-xl bg-black/5 px-3 py-1 text-xs text-gray-600" onClick={() => responder(r.fromUid, false)}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Lista de amigos */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Seus amigos</h2>
        {friends.length === 0 ? (
          <div className="card py-8 text-center text-sm text-gray-400">Você ainda não tem amigos no Sabido.</div>
        ) : (
          friends.map((f) => (
            <div key={f.uid} className="card flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-100 text-sm">
                {f.photoURL ? <img src={f.photoURL} alt="" className="h-9 w-9 object-cover" /> : '👤'}
              </div>
              <span className="flex-1 text-gray-800">{f.displayName}</span>
              <span className="text-xs text-gray-400">@{f.username}</span>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
