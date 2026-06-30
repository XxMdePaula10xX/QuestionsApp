import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/reportsRepo'

/** Botão discreto + folha de motivos para reportar uma pergunta (Seção 8.7). */
export function ReportButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  async function report(reason: ReportReason) {
    await submitReport(questionId, reason)
    setDone(true)
    setOpen(false)
  }

  if (done) return <p className="text-center text-xs text-gray-400">Obrigado! Reporte enviado. 🙏</p>

  return (
    <>
      <button onClick={() => setOpen(true)} className="mx-auto text-xs text-gray-400 underline">
        Reportar pergunta
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-white p-5"
            >
              <p className="mb-3 font-bold text-gray-800">Qual o problema?</p>
              <div className="flex flex-col gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => report(r.id)}
                    className="rounded-2xl bg-black/5 px-4 py-3 text-left font-medium text-gray-700 hover:bg-black/10"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="mt-3 w-full py-2 text-sm text-gray-400">
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
