import { create } from 'zustand'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '@/lib/firebase'

interface AuthState {
  user: User | null
  /** true enquanto resolvemos o estado inicial de auth. */
  initializing: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  /** Liga o listener do Firebase; retorna unsubscribe. */
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
    return onAuthStateChanged(auth, (user) => {
      set({ user, initializing: false })
    })
  },

  signInWithGoogle: async () => {
    if (!auth) throw new Error('Firebase não configurado')
    await signInWithPopup(auth, new GoogleAuthProvider())
    // TODO(Sprint 1): criar/atualizar users/{uid} + users/{uid}/private/{uid}.
  },

  signOut: async () => {
    if (!auth) return
    await fbSignOut(auth)
  },
}))
