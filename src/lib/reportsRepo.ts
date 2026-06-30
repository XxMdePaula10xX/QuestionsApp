import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured, auth } from '@/lib/firebase'
import { loadJSON, saveJSON } from '@/lib/persist'
import type { QuestionReport } from '@/types/models'

export type ReportReason = QuestionReport['reason']

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'errada', label: 'Resposta errada' },
  { id: 'segunda_resposta', label: 'Tem outra resposta certa' },
  { id: 'ambigua', label: 'Pergunta ambígua' },
  { id: 'ofensiva', label: 'Conteúdo ofensivo' },
  { id: 'outro', label: 'Outro' },
]

/**
 * Reporte de pergunta (Seção 4.5/8.7). Id determinístico reports/{questionId}_{uid}
 * impede flood do mesmo usuário (revisão). Offline/guest: enfileira localmente.
 */
export async function submitReport(questionId: string, reason: ReportReason, comment?: string): Promise<void> {
  const uid = auth?.currentUser?.uid
  if (isFirebaseConfigured && db && uid) {
    const ref = doc(db, 'reports', `${questionId}_${uid}`)
    await setDoc(ref, {
      questionId,
      uid,
      reason,
      ...(comment ? { comment } : {}),
      createdAt: serverTimestamp(),
      status: 'aberto',
    })
    return
  }
  // Fila local (reconciliada quando logar).
  const queue = await loadJSON<{ questionId: string; reason: ReportReason; comment?: string }[]>('reportQueue', [])
  if (!queue.some((r) => r.questionId === questionId)) {
    queue.push({ questionId, reason, comment })
    await saveJSON('reportQueue', queue)
  }
}
