import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { levelProgress } from '@/lib/leveling'
import { CATEGORIES } from '@/lib/categories'
import type { CategoryId } from '@/types/question'

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const profile = useProfileStore((s) => s.profile)
  const resetProgress = useProfileStore((s) => s.resetProgress)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDelError(null)
    try {
      await deleteAccount()
      await resetProgress()
    } catch (e) {
      setDelError(e instanceof Error ? e.message : 'Não foi possível excluir a conta.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const prog = levelProgress(profile.xp)
  const acc =
    profile.stats.totalAnswered > 0
      ? Math.round((profile.stats.totalCorrect / profile.stats.totalAnswered) * 100)
      : 0

  const catRows = CATEGORIES.map((c) => {
    const s = profile.statsByCategory[c.id as CategoryId]
    const pct = s && s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0
    return { ...c, answered: s?.answered ?? 0, pct }
  }).filter((r) => r.answered > 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-700">Perfil</h1>

      <div className="card flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-16 w-16 object-cover" /> : '👤'}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">{user?.displayName ?? 'Convidado'}</p>
          <p className="text-sm text-gray-500">
            Nível {prog.level} · {profile.xp} XP
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Partidas" value={profile.stats.gamesPlayed} />
        <Stat label="Acertos" value={profile.stats.totalCorrect} />
        <Stat label="Precisão" value={`${acc}%`} />
      </div>

      <div className="card flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Precisão por categoria</p>
        {catRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Jogue uma partida para ver suas estatísticas.</p>
        ) : (
          catRows.map((r) => (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {r.emoji} {r.nome}
                </span>
                <span className="font-semibold text-gray-700">{r.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5">
                <div className={`h-full ${r.color}`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))
        )}
      </div>

      <Link to="/amigos" className="card flex items-center justify-between">
        <span className="font-semibold text-gray-800">👥 Amigos</span>
        <span className="text-brand-600">Ver →</span>
      </Link>

      <Link to="/conquistas" className="card flex items-center justify-between">
        <span className="font-semibold text-gray-800">
          🏅 Conquistas <span className="text-sm text-gray-400">({profile.achievements.length})</span>
        </span>
        <span className="text-brand-600">Ver →</span>
      </Link>

      {user ? (
        <>
          <button className="btn-ghost bg-red-50 text-red-600 hover:bg-red-100" onClick={() => signOut()}>
            Sair da conta
          </button>

          {!confirmDelete ? (
            <button className="text-xs text-red-400 underline" onClick={() => setConfirmDelete(true)}>
              Excluir minha conta
            </button>
          ) : (
            <div className="card flex flex-col gap-3 ring-1 ring-red-200">
              <p className="text-sm text-gray-700">
                Isso apaga sua conta, perfil, estatísticas, amizades e posição nos rankings.{' '}
                <strong>Não dá para desfazer.</strong>
              </p>
              {delError && <p className="text-xs text-red-500">{delError}</p>}
              <div className="flex gap-2">
                <button
                  className="btn flex-1 bg-red-600 text-white disabled:opacity-50"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
                </button>
                <button className="btn flex-1 bg-black/5 text-gray-600" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <a href="/login" className="btn-primary">
          Entrar
        </a>
      )}
      <button className="text-xs text-gray-400 underline" onClick={() => resetProgress()}>
        Zerar progresso local
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card flex flex-col items-center py-4">
      <span className="text-2xl font-extrabold text-brand-700">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}
