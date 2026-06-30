import { collection, endAt, getDocs, limit, orderBy, query, startAt, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, isFirebaseConfigured, auth } from '@/lib/firebase'
import type { Friend, FriendRequest, UserProfile } from '@/types/models'

export type FoundUser = Pick<UserProfile, 'uid' | 'displayName' | 'username' | 'photoURL'>

/**
 * Amizades mútuas (revisão: pedido + aceite). As ESCRITAS (pedido/aceite) passam
 * por Cloud Function, que grava os dois lados atomicamente; o cliente só lê.
 * Online-only — sem Firebase, retorna vazio.
 */

function pick(u: UserProfile): FoundUser {
  return { uid: u.uid, displayName: u.displayName, username: u.username, photoURL: u.photoURL }
}

/** Busca por @username exato (usado pelo link de convite). */
export async function searchByUsername(username: string): Promise<FoundUser | null> {
  if (!isFirebaseConfigured || !db) return null
  const handle = username.trim().toLowerCase().replace(/^@/, '')
  if (!handle) return null
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', handle), limit(1)))
  if (snap.empty) return null
  const u = snap.docs[0].data() as UserProfile
  if (u.uid === auth?.currentUser?.uid) return null
  return pick(u)
}

/** Busca por NOME (prefixo) OU @username — caixa de busca de amigos. */
export async function searchUsers(term: string): Promise<FoundUser[]> {
  if (!isFirebaseConfigured || !db) return []
  const t = term.trim().toLowerCase().replace(/^@/, '')
  if (t.length < 2) return []
  const me = auth?.currentUser?.uid
  const found = new Map<string, FoundUser>()

  // 1) username exato
  const byUser = await getDocs(query(collection(db, 'users'), where('username', '==', t), limit(3)))
  byUser.forEach((d) => found.set(d.id, pick(d.data() as UserProfile)))

  // 2) nome por prefixo (nameLower)
  const byName = await getDocs(
    query(collection(db, 'users'), orderBy('nameLower'), startAt(t), endAt(t + '\uf8ff'), limit(10)),
  )
  byName.forEach((d) => found.set(d.id, pick(d.data() as UserProfile)))

  if (me) found.delete(me)
  return [...found.values()].slice(0, 10)
}

/** Altera o @username (único). Retorna o novo username ou lança erro legível. */
export async function changeUsername(username: string): Promise<string> {
  if (!functions) throw new Error('Entre com uma conta')
  const res = await httpsCallable<{ username: string }, { username: string }>(functions, 'changeUsername')({ username })
  return res.data.username
}

export async function sendFriendRequest(toUid: string): Promise<void> {
  if (!functions) throw new Error('Firebase não configurado')
  await httpsCallable(functions, 'sendFriendRequest')({ toUid })
}

export async function respondFriendRequest(fromUid: string, accept: boolean): Promise<void> {
  if (!functions) throw new Error('Firebase não configurado')
  await httpsCallable(functions, 'respondFriendRequest')({ fromUid, accept })
}

export async function listFriends(uid: string): Promise<Friend[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(collection(db, 'users', uid, 'friends'))
  return snap.docs.map((d) => d.data() as Friend)
}

export async function listFriendRequests(uid: string): Promise<FriendRequest[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(collection(db, 'users', uid, 'friendRequests'))
  return snap.docs.map((d) => d.data() as FriendRequest)
}

/** Link de convite (deep link Capacitor — vetor viral, K-factor). */
export function inviteLink(username: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sabido.app'
  return `${origin}/convite/${username}`
}
