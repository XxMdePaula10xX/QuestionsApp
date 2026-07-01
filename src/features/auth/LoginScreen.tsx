import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'

type Mode = 'login' | 'signup'
const CURRENT_YEAR = new Date().getFullYear()

export function LoginScreen() {
  const navigate = useNavigate()
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na autenticação')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de redefinição.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await resetPassword(email.trim())
      setInfo('Enviamos um link de redefinição para o seu e-mail.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o e-mail.')
    } finally {
      setBusy(false)
    }
  }

  const year = Number(birthYear)
  const validSignup = email && password.length >= 6 && displayName && year >= 1900 && year <= CURRENT_YEAR

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-600 to-brand-800 px-6 py-[calc(2rem+env(safe-area-inset-top))] text-center text-white">
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

        {mode === 'login' && (
          <button className="text-sm text-brand-100 underline" disabled={busy || !isFirebaseConfigured} onClick={handleReset}>
            Esqueci a senha
          </button>
        )}

        <button
          className="text-sm text-brand-100 underline"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>

      <button className="btn-ghost w-full" onClick={() => navigate('/', { replace: true })}>
        Entrar como convidado
      </button>

      {!isFirebaseConfigured && (
        <p className="text-xs text-brand-200">
          Firebase não configurado — preencha <code>.env.local</code> para habilitar o login. O modo convidado funciona offline.
        </p>
      )}
      {info && <p className="text-sm text-green-200">{info}</p>}
      {error && <p className="text-sm text-red-200">{error}</p>}
    </div>
  )
}
