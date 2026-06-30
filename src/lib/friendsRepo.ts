import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, isFirebaseConfigured, auth } from '@/lib/firebase'
import type { Friend, FriendRequest, UserProfile } from '@/types/models'

/**
 * Amizades mútuas (revisão: pedido + aceite). As ESCRITAS (pedido/aceite) passam
 * por Cloud Function, que grava os dois lados atomicamente; o cliente só lê.
 * Online-only — sem Firebase, retorna vazio.
 */

export async function searchByUsername(username: string): Promise<Pick<UserProfile, 'uid' | 'displayName' | 'username' | 'photoURL'> | null> {
  if (!isFirebaseConfigured || !db) return null
  const handle = username.trim().toLowerCase()
  if (!handle) return null
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', handle), limit(1)))
  if (snap.empty) return null
  const u = snap.docs[0].data() as UserProfile
  if (u.uid === auth?.currentUser?.uid) return null // não a si mesmo
  return { uid: u.uid, displayName: u.displayName, username: u.username, photoURL: u.photoURL }
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
  return `https://sabido.app/convite/${username}`
}
