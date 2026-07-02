import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions, isFirebaseConfigured } from '@/lib/firebase'
import { ensureProfile, type OnboardingData } from '@/lib/userRepo'
import { registerForPush } from '@/lib/push'

interface AuthState {
  user: User | null
  initializing: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string, onboarding: OnboardingData) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  deleteAccount: () => Promise<void>
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
          void registerForPush()
        } catch {
          /* offline / regras — ignora */
        }
      }
    })
  },

  signInWithEmail: async (email, password) => {
    if (!auth) throw new Error('Firebase não configurado')
    await signInWithEmailAndPassword(auth, email, password)
  },

  signUpWithEmail: async (email, password, displayName, onboarding) => {
    if (!auth) throw new Error('Firebase não configurado')
    // A ÚNICA etapa que pode (e deve) segurar o cadastro é criar a conta no Auth.
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    // Nome + perfil/PII no Firestore rodam em SEGUNDO PLANO e NÃO são aguardados.
    // Motivo: no WKWebView um setDoc do Firestore pode ficar PENDENTE para sempre
    // (offline/WebChannel) — ele não lança erro, só nunca resolve. Aguardar isso
    // travava o botão em "Criando conta…" eternamente. O perfil é refeito no
    // próximo carregamento (init → onAuthStateChanged → ensureProfile).
    void (async () => {
      try {
        await updateProfile(cred.user, { displayName })
        await ensureProfile(cred.user, onboarding)
      } catch (e) {
        console.warn('[Sabido] cadastro: perfil em segundo plano não gravou agora:', e)
      }
    })()
  },

  resetPassword: async (email) => {
    if (!auth) throw new Error('Firebase não configurado')
    await sendPasswordResetEmail(auth, email)
  },

  deleteAccount: async () => {
    if (!auth || !functions) throw new Error('Firebase não configurado')
    // A Cloud Function apaga perfil, PII, rankings, amizades e a conta de auth (LGPD).
    await httpsCallable(functions, 'deleteAccount')()
    await fbSignOut(auth)
  },

  signOut: async () => {
    if (!auth) return
    await fbSignOut(auth)
  },
}))
