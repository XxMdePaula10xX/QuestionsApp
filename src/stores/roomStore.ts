import { create } from 'zustand'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
} from 'firebase/firestore'
import type { CategoryId, Question } from '@/types/question'
import { db, isFirebaseConfigured, auth } from '@/lib/firebase'
import { loadCategories, getQuestionsByIds, shuffle } from '@/lib/questionsLoader'
import { PLAYABLE_CATEGORIES } from '@/lib/categories'

/**
 * #4 Sala (estilo Kahoot): partida presencial sincronizada por código de 4
 * letras, em tempo real via Firestore (onSnapshot) — sem servidor de jogo.
 * Modo casual/festa: pontuação local (não alimenta o ranking competitivo).
 * Online-only (precisa estar logado para escrever no Firestore).
 */
const ROOM_QUESTIONS = 8

export interface RoomDoc {
  code: string
  hostUid: string
  status: 'lobby' | 'playing' | 'finished'
  category: CategoryId | null
  questionIds: string[]
  currentIndex: number
  createdAt: number
}
export interface RoomPlayer {
  uid: string
  name: string
  score: number
  answeredIndex: number
}

function code4(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('')
}
function me() {
  return { uid: auth?.currentUser?.uid ?? '', name: auth?.currentUser?.displayName ?? 'Jogador' }
}

interface RoomState {
  code: string | null
  room: RoomDoc | null
  players: RoomPlayer[]
  questions: Question[]
  picked: number | null
  error: string | null
  unsubs: Array<() => void>
  create: (category: CategoryId | null) => Promise<string>
  join: (code: string) => Promise<void>
  start: () => Promise<void>
  answer: (choice: number) => Promise<void>
  next: () => Promise<void>
  leave: () => void
  isHost: () => boolean
}

export const useRoomStore = create<RoomState>((set, get) => ({
  code: null,
  room: null,
  players: [],
  questions: [],
  picked: null,
  error: null,
  unsubs: [],

  isHost: () => !!get().room && get().room!.hostUid === me().uid,

  create: async (category) => {
    if (!isFirebaseConfigured || !db || !auth?.currentUser) throw new Error('Entre com uma conta para criar uma sala')
    const pool = category ? await loadCategories([category]) : await loadCategories(PLAYABLE_CATEGORIES)
    const qids = shuffle(pool).slice(0, ROOM_QUESTIONS).map((q) => q.id)
    const code = code4()
    const { uid, name } = me()
    await setDoc(doc(db, 'rooms', code), {
      code, hostUid: uid, status: 'lobby', category, questionIds: qids, currentIndex: -1, createdAt: Date.now(),
    })
    await setDoc(doc(db, 'rooms', code, 'players', uid), { uid, name, score: 0, answeredIndex: -1 })
    await get().join(code)
    return code
  },

  join: async (code) => {
    if (!isFirebaseConfigured || !db || !auth?.currentUser) throw new Error('Entre com uma conta para entrar na sala')
    code = code.trim().toUpperCase()
    const roomRef = doc(db, 'rooms', code)
    const snap = await getDoc(roomRef)
    if (!snap.exists()) {
      set({ error: 'Sala não encontrada' })
      throw new Error('Sala não encontrada')
    }
    const { uid, name } = me()
    await setDoc(doc(db, 'rooms', code, 'players', uid), { uid, name, score: 0, answeredIndex: -1 }, { merge: true })

    const room = snap.data() as RoomDoc
    const questions = await getQuestionsByIds(room.questionIds, room.category ? [room.category] : PLAYABLE_CATEGORIES)

    get().leave()
    const u1 = onSnapshot(roomRef, (d) => {
      if (d.exists()) set({ room: d.data() as RoomDoc, picked: null })
    })
    const u2 = onSnapshot(collection(db, 'rooms', code, 'players'), (qs) => {
      set({ players: qs.docs.map((p) => p.data() as RoomPlayer).sort((a, b) => b.score - a.score) })
    })
    set({ code, questions, unsubs: [u1, u2], error: null })
  },

  start: async () => {
    const { code, room } = get()
    if (!db || !code || !room) return
    await updateDoc(doc(db, 'rooms', code), { status: 'playing', currentIndex: 0 })
  },

  answer: async (choice) => {
    const { code, room, questions, picked } = get()
    if (!db || !code || !room || picked !== null || room.status !== 'playing') return
    const q = questions[room.currentIndex]
    if (!q) return
    set({ picked: choice })
    const { uid } = me()
    const correct = choice === q.answerIndex
    await updateDoc(doc(db, 'rooms', code, 'players', uid), {
      answeredIndex: room.currentIndex,
      ...(correct ? { score: increment(100) } : {}),
    })
  },

  next: async () => {
    const { code, room, questions } = get()
    if (!db || !code || !room) return
    const nextIdx = room.currentIndex + 1
    if (nextIdx >= questions.length) {
      await updateDoc(doc(db, 'rooms', code), { status: 'finished' })
    } else {
      await updateDoc(doc(db, 'rooms', code), { currentIndex: nextIdx })
    }
  },

  leave: () => {
    get().unsubs.forEach((u) => u())
    set({ unsubs: [] })
  },
}))
