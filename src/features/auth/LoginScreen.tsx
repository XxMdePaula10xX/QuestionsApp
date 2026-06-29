import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'

export function LoginScreen() {
  const navigate = useNavigate()
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleGoogle() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-8 bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-center text-white">
      <div>
        <p className="text-5xl">🧠</p>
        <h1 className="mt-3 text-4xl font-extrabold">Sabido</h1>
        <p className="mt-2 text-brand-100">O quiz brasileiro. Mostre que você é sabido.</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button className="btn bg-white text-gray-800 hover:bg-gray-100" disabled={busy || !isFirebaseConfigured} onClick={handleGoogle}>
          Entrar com Google
        </button>
        {/* TODO(Sprint 1): login por e-mail/senha + gate de idade (LGPD, blocker B4). */}
        <button className="btn-ghost" onClick={() => navigate('/', { replace: true })}>
          Entrar como convidado
        </button>
      </div>

      {!isFirebaseConfigured && (
        <p className="text-xs text-brand-200">
          Firebase não configurado — preencha o <code>.env.local</code> para habilitar o login.
        </p>
      )}
      {error && <p className="text-sm text-red-200">{error}</p>}
    </div>
  )
}
