import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'

type Mode = 'login' | 'signup'
const CURRENT_YEAR = new Date().getFullYear()

export function LoginScreen() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na autenticação')
    } finally {
      setBusy(false)
    }
  }

  const year = Number(birthYear)
  const validSignup = email && password.length >= 6 && displayName && year >= 1900 && year <= CURRENT_YEAR

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-600 to-brand-800 px-6 text-center text-white">
      <div>
        <p className="text-5xl">🧠</p>
        <h1 className="mt-3 text-4xl font-extrabold">Sabido</h1>
        <p className="mt-1 text-brand-100">Mostre que você é sabido.</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl px-4 py-3 text-gray-800 outline-none"
        />
        <input
          type="password"
          placeholder="Senha (mín. 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl px-4 py-3 text-gray-800 outline-none"
        />
        {mode === 'signup' && (
          <>
            <input
              placeholder="Seu nome"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-2xl px-4 py-3 text-gray-800 outline-none"
            />
            <input
              inputMode="numeric"
              placeholder="Ano de nascimento"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="rounded-2xl px-4 py-3 text-gray-800 outline-none"
            />
          </>
        )}

        {mode === 'login' ? (
          <button
            className="btn bg-white text-brand-700"
            disabled={busy || !isFirebaseConfigured || !email || !password}
            onClick={() => run(() => signInWithEmail(email, password))}
          >
            Entrar
          </button>
        ) : (
          <button
            className="btn bg-white text-brand-700 disabled:opacity-50"
            disabled={busy || !isFirebaseConfigured || !validSignup}
            onClick={() => run(() => signUpWithEmail(email, password, displayName, { birthYear: year }))}
          >
            Criar conta
          </button>
        )}

        <button className="text-sm text-brand-100 underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>

      <div className="flex w-full items-center gap-3 text-brand-200">
        <div className="h-px flex-1 bg-white/20" />
        ou
        <div className="h-px flex-1 bg-white/20" />
      </div>

      <div className="flex w-full flex-col gap-3">
        <button className="btn bg-white/10 text-white hover:bg-white/20" disabled={busy || !isFirebaseConfigured} onClick={() => run(signInWithGoogle)}>
          Entrar com Google
        </button>
        <button className="btn-ghost" onClick={() => navigate('/', { replace: true })}>
          Entrar como convidado
        </button>
      </div>

      {!isFirebaseConfigured && (
        <p className="text-xs text-brand-200">
          Firebase não configurado — preencha <code>.env.local</code> para habilitar o login. O modo convidado funciona offline.
        </p>
      )}
      {error && <p className="text-sm text-red-200">{error}</p>}
    </div>
  )
}
