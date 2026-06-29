import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type { RankingEntry } from '@/types/models'

export type RankingScope = 'global' | 'normal' | 'stop' | 'challenge' | `weekly_${string}`

/**
 * Lê rankings/{scope}/entries ordenado por score (escrita só via Cloud Function).
 * Retorna [] quando o Firebase não está configurado.
 */
export async function fetchRanking(scope: RankingScope, top = 50): Promise<RankingEntry[]> {
  if (!isFirebaseConfigured || !db) return []
  const ref = collection(db, 'rankings', scope, 'entries')
  const snap = await getDocs(query(ref, orderBy('score', 'desc'), limit(top)))
  return snap.docs.map((d) => d.data() as RankingEntry)
}
