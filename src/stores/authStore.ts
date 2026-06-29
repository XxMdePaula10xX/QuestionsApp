import { create } from 'zustand'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { ensureProfile, type OnboardingData } from '@/lib/userRepo'

interface AuthState {
  user: User | null
  initializing: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string, onboarding: OnboardingData) => Promise<void>
  signOut: () => Promise<void>
  init: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,

  init: () => {
    if (!isFirebaseConfigured || !auth) {
      set({ initializing: false })
      return () => {}
    }
    return onAuthStateChanged(auth, async (user) => {
      set({ user, initializing: false })
      if (user) {
        try {
          await ensureProfile(user)
        } catch {
          /* offline / regras — ignora */
        }
      }
    })
  },

  signInWithGoogle: async () => {
    if (!auth) throw new Error('Firebase não configurado')
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    await ensureProfile(cred.user)
  },

  signInWithEmail: async (email, password) => {
    if (!auth) throw new Error('Firebase não configurado')
    await signInWithEmailAndPassword(auth, email, password)
  },

  signUpWithEmail: async (email, password, displayName, onboarding) => {
    if (!auth) throw new Error('Firebase não configurado')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    await ensureProfile(cred.user, onboarding)
  },

  signOut: async () => {
    if (!auth) return
    await fbSignOut(auth)
  },
}))
