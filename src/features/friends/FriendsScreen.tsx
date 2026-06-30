import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  changeUsername,
  inviteLink,
  listFriendRequests,
  listFriends,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FoundUser,
} from '@/lib/friendsRepo'
import { fetchProfile } from '@/lib/userRepo'
import type { Friend, FriendRequest } from '@/types/models'

export function FriendsScreen() {
  const user = useAuthStore((s) => s.user)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [searched, setSearched] = useState(false)
  const [myUsername, setMyUsername] = useState('voce')
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState(false)
  const [newUser, setNewUser] = useState('')
  const [userErr, setUserErr] = useState<string | null>(null)
  const [savingUser, setSavingUser] = useState(false)

  async function salvarUsername() {
    setSavingUser(true)
    setUserErr(null)
    try {
      const u = await changeUsername(newUser)
      setMyUsername(u)
      setEditingUser(false)
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      setUserErr(/already-exists|em uso/i.test(m) ? 'Esse @usuário já está em uso.' : /invalid|caracteres/i.test(m) ? 'Use 3 a 15 caracteres: letras minúsculas, números ou _.' : 'Não foi possível alterar.')
    } finally {
      setSavingUser(false)
    }
  }

  useEffect(() => {
    if (!user) return
    listFriends(user.uid).then(setFriends)
    listFriendRequests(user.uid).then(setRequests)
    fetchProfile(user.uid).then((p) => p?.username && setMyUsername(p.username))
  }, [user])

  async function buscar() {
    setMsg(null)
    setSearched(true)
    setResults(await searchUsers(term))
  }

  async function adicionar(uid: string) {
    try {
      await sendFriendRequest(uid)
      setSentTo((s) => new Set(s).add(uid))
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

      {/* Nome de usuário (editável e único) */}
      {user && (
        <div className="card flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-700">Seu nome de usuário</p>
          {!editingUser ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-800">@{myUsername}</span>
              <button
                className="text-sm font-semibold text-brand-600"
                onClick={() => {
                  setNewUser(myUsername)
                  setUserErr(null)
                  setEditingUser(true)
                }}
              >
                Editar
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">@</span>
                <input
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15))}
                  placeholder="seunome"
                  className="flex-1 rounded-xl px-3 py-2 ring-1 ring-black/10 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1 py-2 text-sm disabled:opacity-50" disabled={savingUser || newUser.length < 3} onClick={salvarUsername}>
                  {savingUser ? 'Salvando…' : 'Salvar'}
                </button>
                <button className="flex-1 rounded-2xl bg-black/5 py-2 text-sm text-gray-600" onClick={() => setEditingUser(false)}>
                  Cancelar
                </button>
              </div>
              {userErr && <p className="text-xs text-red-500">{userErr}</p>}
              <p className="text-xs text-gray-400">3 a 15 caracteres: letras minúsculas, números ou _.</p>
            </>
          )}
        </div>
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

      {/* Busca por nome ou @usuário */}
      <div className="card flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Adicionar amigo</p>
        <div className="flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Nome ou @usuário"
            className="flex-1 rounded-xl px-3 py-2 ring-1 ring-black/10 outline-none"
          />
          <button className="btn-primary px-4 py-2 text-sm" onClick={buscar} disabled={term.trim().length < 2 || !isFirebaseConfigured}>
            Buscar
          </button>
        </div>
        {results.map((r) => (
          <div key={r.uid} className="flex items-center justify-between rounded-xl bg-brand-50 p-2">
            <span className="text-sm text-gray-700">
              {r.displayName} <span className="text-gray-400">@{r.username}</span>
            </span>
            {sentTo.has(r.uid) ? (
              <span className="px-3 py-1 text-xs font-semibold text-green-600">Enviado ✓</span>
            ) : (
              <button className="btn-primary px-3 py-1 text-xs" onClick={() => adicionar(r.uid)}>
                Adicionar
              </button>
            )}
          </div>
        ))}
        {searched && results.length === 0 && <p className="text-xs text-gray-500">Ninguém encontrado. Tente o nome exato ou o @usuário.</p>}
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
