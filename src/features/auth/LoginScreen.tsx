import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isFirebaseConfigured } from '@/lib/firebase'

type Mode = 'login' | 'signup'
const CURRENT_YEAR = new Date().getFullYear()

/** Traduz o erro do Firebase para PT-BR e SEMPRE inclui o código quando útil,
 *  para o problema deixar de ser invisível ("nada acontece"). */
function authErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já tem conta. Toque em "Já tem conta? Entrar".',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'Senha fraca — use ao menos 6 caracteres.',
    'auth/operation-not-allowed':
      'Login por e-mail/senha não está habilitado no Firebase (Authentication → Sign-in method).',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
  }
  if (map[code]) return map[code]
  if (code.toLowerCase().includes('app-check') || code.toLowerCase().includes('appcheck'))
    return `Falha de verificação de segurança (App Check) — ${code}`
  const msg = e instanceof Error ? e.message : 'Falha na autenticação'
  return code ? `${msg} (${code})` : msg
}

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
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      // Rede de segurança: se a operação não resolver em 20s (ex.: chamada
      // pendurada no WebView), abortamos com mensagem em vez de girar pra sempre.
      await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('__timeout__')), 20000)
        }),
      ])
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof Error && e.message === '__timeout__') {
        setError(
          'Está demorando demais para responder. Verifique sua conexão. Se persistir, veja se o App Check está como "Não forçado" no console do Firebase.',
        )
      } else {
        setError(authErrorText(e))
      }
    } finally {
      if (timer) clearTimeout(timer)
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
      setError(authErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const year = Number(birthYear)

  // Validação com FEEDBACK: em vez de desabilitar o botão silenciosamente
  // (usuário clica e "nada acontece"), avisamos exatamente o que falta.
  function submitLogin() {
    if (!isFirebaseConfigured) return setError('Login indisponível no momento. Tente novamente mais tarde.')
    if (!email.trim()) return setError('Digite seu e-mail.')
    if (password.length < 6) return setError('A senha precisa ter ao menos 6 caracteres.')
    run(() => signInWithEmail(email.trim(), password))
  }

  function submitSignup() {
    if (!isFirebaseConfigured) return setError('Cadastro indisponível no momento. Tente novamente mais tarde.')
    if (!email.trim()) return setError('Digite seu e-mail.')
    if (password.length < 6) return setError('A senha precisa ter ao menos 6 caracteres.')
    if (!displayName.trim()) return setError('Digite seu nome.')
    if (!(year >= 1900 && year <= CURRENT_YEAR)) return setError('Informe um ano de nascimento válido (ex.: 1998).')
    run(() => signUpWithEmail(email.trim(), password, displayName.trim(), { birthYear: year }))
  }

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
          <button className="btn bg-white text-brand-700 disabled:opacity-50" disabled={busy} onClick={submitLogin}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        ) : (
          <button className="btn bg-white text-brand-700 disabled:opacity-50" disabled={busy} onClick={submitSignup}>
            {busy ? 'Criando conta…' : 'Criar conta'}
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
