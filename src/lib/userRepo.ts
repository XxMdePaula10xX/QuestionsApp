import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/types/models'

/**
 * Acesso aos docs de usuário no Firestore. Respeita as security rules:
 *  - o cliente só CRIA o perfil público com campos de jogo zerados;
 *  - PII (email/idade) vai para users/{uid}/private/{uid};
 *  - scores/xp/stats são escritos pela Cloud Function (Sprint 2), não aqui.
 * Tudo vira no-op quando o Firebase não está configurado (modo offline/guest).
 */

export interface OnboardingData {
  birthYear: number
}

export async function ensureProfile(user: User, onboarding?: OnboardingData): Promise<void> {
  if (!db) return
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName ?? 'Jogador',
      photoURL: user.photoURL ?? null,
      level: 1,
      xp: 0,
      stats: { totalCorrect: 0, totalAnswered: 0, gamesPlayed: 0 },
      statsByCategory: {},
      scores: { global: 0, normal: 0, stop: 0, challenge: 0 },
      createdAt: Date.now(),
      schemaVersion: 1,
    }
    await setDoc(ref, profile)
  }

  // PII separada (blocker B4). Só grava se veio onboarding (1ª vez).
  if (onboarding) {
    const privRef = doc(db, 'users', user.uid, 'private', user.uid)
    await setDoc(
      privRef,
      {
        email: user.email ?? null,
        birthYear: onboarding.birthYear,
        acceptedTermsAt: serverTimestamp(),
      },
      { merge: true },
    )
  }
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}
