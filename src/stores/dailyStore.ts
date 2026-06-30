import { create } from 'zustand'
import { httpsCallable } from 'firebase/functions'
import type { Question } from '@/types/question'
import { loadCategories } from '@/lib/questionsLoader'
import { PLAYABLE_CATEGORIES } from '@/lib/categories'
import { dailyKey, pickDailyQuestion } from '@/lib/daily'
import { loadJSON, saveJSON } from '@/lib/persist'
import { functions, isFirebaseConfigured, auth } from '@/lib/firebase'
import { useProfileStore } from '@/stores/profileStore'

interface DailyPersist {
  date: string
  picked: number
}

interface DailyState {
  loaded: boolean
  date: string
  question: Question | null
  answeredToday: boolean
  picked: number | null
  /** % de acertos no Brasil (só online). */
  pctCorrect: number | null
  load: () => Promise<void>
  answer: (i: number) => Promise<void>
}

export const useDailyStore = create<DailyState>((set, get) => ({
  loaded: false,
  date: '',
  question: null,
  answeredToday: false,
  picked: null,
  pctCorrect: null,

  load: async () => {
    const date = dailyKey()
    const all = await loadCategories(PLAYABLE_CATEGORIES)
    const question = pickDailyQuestion(all, date)
    const stored = await loadJSON<DailyPersist | null>('daily', null)
    const answeredToday = stored?.date === date
    set({
      loaded: true,
      date,
      question,
      answeredToday,
      picked: answeredToday ? stored!.picked : null,
    })
  },

  answer: async (i) => {
    const { question, date, answeredToday } = get()
    if (!question || answeredToday) return
    set({ picked: i, answeredToday: true })
    await saveJSON('daily', { date, picked: i })
    void useProfileStore.getState().markSeen([question.id])

    // Agregado nacional (só online + logado).
    if (isFirebaseConfigured && functions && auth?.currentUser) {
      try {
        const res = await httpsCallable<
          { date: string; questionId: string; answerIndex: number },
          { total: number; correct: number; pctCorrect: number }
        >(functions, 'answerDaily')({ date, questionId: question.id, answerIndex: i })
        set({ pctCorrect: res.data.pctCorrect })
      } catch {
        /* sem rede — fica só o resultado local */
      }
    }
  },
}))
