import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProfileStore } from '@/stores/profileStore'

/** Toast global que anuncia conquistas recém-desbloqueadas (fila). */
export function AchievementToast() {
  const justUnlocked = useProfileStore((s) => s.justUnlocked)
  const clear = useProfileStore((s) => s.clearJustUnlocked)
  const current = justUnlocked[0]

  useEffect(() => {
    if (!current) return
    const t = setTimeout(clear, 3500)
    return () => clearTimeout(t)
  }, [current, clear])

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          onClick={clear}
          className="fixed inset-x-0 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5"
          style={{ width: 'calc(100% - 2rem)', top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-2xl">{current.emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Conquista desbloqueada!</p>
            <p className="font-bold text-gray-800">{current.title}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
