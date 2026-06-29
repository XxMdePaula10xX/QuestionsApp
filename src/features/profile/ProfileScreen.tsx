import { useAuthStore } from '@/stores/authStore'

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-700">Perfil</h1>

      <div className="card flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-16 w-16 object-cover" /> : '👤'}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">{user?.displayName ?? 'Convidado'}</p>
          <p className="text-sm text-gray-500">Nível 1 · 0 XP</p>
        </div>
      </div>

      {/* Precisão por categoria (radar/barras) — Sprint 1+ usando statsByCategory. */}
      <div className="card flex flex-col items-center gap-2 py-10 text-center text-gray-400">
        <span className="text-3xl">📊</span>
        <p className="text-sm">Estatísticas por categoria em breve.</p>
      </div>

      {user ? (
        <button className="btn-ghost bg-red-50 text-red-600 hover:bg-red-100" onClick={() => signOut()}>
          Sair da conta
        </button>
      ) : (
        <a href="/login" className="btn-primary">
          Entrar
        </a>
      )}
    </div>
  )
}
