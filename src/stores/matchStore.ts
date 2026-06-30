import { create } from 'zustand'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { CategoryId, Question } from '@/types/question'
import type { Match } from '@/types/models'
import { loadCategories, getQuestionsByIds, shuffle } from '@/lib/questionsLoader'
import { PLAYABLE_CATEGORIES } from '@/lib/categories'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { botPlay, decideWinner, scoreAnswers } from '@/lib/matchEngine'
import { loadJSON, saveJSON } from '@/lib/persist'
import { auth, db, functions, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Desafios assíncronos.
 *  - LOGADO (Firebase): partidas reais no Firestore, criadas/pontuadas pelas
 *    Cloud Functions (revelação cega — B2), atualizadas em tempo real (onSnapshot).
 *  - CONVIDADO/offline: partidas locais contra um bot, para treinar.
 */

const KEY = 'matches'
const BOT_UID = 'bot'
const BOT_NAME = 'Robô Sabido 🤖'

function localUid(): string {
  return auth?.currentUser?.uid ?? 'me'
}
function localName(): string {
  return auth?.currentUser?.displayName ?? 'Você'
}

function docToMatch(id: string, x: Record<string, unknown>): Match {
  return {
    id,
    players: (x.players as string[]) ?? [],
    playerNames: (x.playerNames as Record<string, string>) ?? {},
    category: (x.category as CategoryId | null) ?? null,
    questionIds: (x.questionIds as string[]) ?? [],
    status: (x.status as Match['status']) ?? 'WAITING',
    results: (x.results as Match['results']) ?? {},
    winnerId: (x.winnerId as string | null) ?? null,
    createdAt: (x.createdAt as number) ?? 0,
    expiresAt: (x.expiresAt as number) ?? 0,
  }
}

interface MatchState {
  matches: Match[]
  loaded: boolean
  online: boolean
  unsub: (() => void) | null
  /** (Re)conecta a fonte de partidas conforme o login. */
  init: (uid: string | null) => void
  /** opponent: uid de um amigo, null = aleatório, 'bot' = treino local. */
  createMatch: (opponent: string | null | 'bot', category: CategoryId | null) => Promise<string>
  resolveQuestions: (matchId: string) => Promise<Question[]>
  submitTurn: (matchId: string, answers: number[], timeMs: number) => Promise<Match>
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  loaded: false,
  online: false,
  unsub: null,

  init: (uid) => {
    get().unsub?.()
    if (isFirebaseConfigured && db && uid) {
      // Online: assina as partidas do usuário em tempo real.
      const q = query(collection(db, 'matches'), where('players', 'array-contains', uid))
      const unsub = onSnapshot(
        q,
        (snap) => {
          const matches = snap.docs
            .map((d) => docToMatch(d.id, d.data()))
            .sort((a, b) => b.createdAt - a.createdAt)
          set({ matches, loaded: true })
        },
        () => set({ loaded: true }),
      )
      set({ online: true, unsub, loaded: false })
    } else {
      // Offline/convidado: partidas locais.
      set({ online: false, unsub: null })
      loadJSON<Match[]>(KEY, []).then((matches) => set({ matches, loaded: true }))
    }
  },

  createMatch: async (opponent, category) => {
    // Caminho online (logado + oponente real).
    if (get().online && functions && opponent !== 'bot') {
      const callable = httpsCallable<{ opponentUid: string | null; category: string | null }, { matchId: string }>(
        functions,
        'createMatch',
      )
      const res = await callable({ opponentUid: opponent, category })
      return res.data.matchId
    }

    // Caminho local (bot).
    const pool = category ? await loadCategories([category]) : await loadCategories(PLAYABLE_CATEGORIES)
    const qs = shuffle(pool).slice(0, GAME_CONFIG.matchQuestionCount)
    const now = Date.now()
    const me = localUid()
    const match: Match = {
      id: `m_${now}_${Math.floor(Math.random() * 1e6)}`,
      players: [me, BOT_UID],
      playerNames: { [me]: localName(), [BOT_UID]: BOT_NAME },
      category,
      questionIds: qs.map((q) => q.id),
      status: 'WAITING',
      results: {},
      winnerId: null,
      createdAt: now,
      expiresAt: now + GAME_CONFIG.matchExpiryDays * 86_400_000,
      isBot: true,
    }
    const matches = [match, ...get().matches]
    set({ matches })
    await saveJSON(KEY, matches)
    return match.id
  },

  resolveQuestions: async (matchId) => {
    const m = get().matches.find((x) => x.id === matchId)
    if (!m) throw new Error('Partida não encontrada')
    const from = m.category ? [m.category] : PLAYABLE_CATEGORIES
    return getQuestionsByIds(m.questionIds, from)
  },

  submitTurn: async (matchId, answers, timeMs) => {
    const m = get().matches.find((x) => x.id === matchId)
    if (!m) throw new Error('Partida não encontrada')

    // Online: a Cloud Function pontua e revela (B2); buscamos o doc atualizado.
    if (get().online && db && functions && !m.isBot) {
      await httpsCallable<{ matchId: string; answers: number[] }, unknown>(functions, 'submitMatchTurn')({ matchId, answers })
      const fresh = await getDoc(doc(db, 'matches', matchId))
      const updated = docToMatch(matchId, fresh.data() ?? {})
      set({ matches: get().matches.map((x) => (x.id === matchId ? updated : x)) })
      return updated
    }

    // Local (bot): pontua aqui, bot joga, decide o vencedor.
    const from = m.category ? [m.category] : PLAYABLE_CATEGORIES
    const questions = await getQuestionsByIds(m.questionIds, from)
    const me = localUid()
    const myRes = { correct: scoreAnswers(questions, answers).correct, total: questions.length, timeMs, finishedAt: Date.now() }
    const botRes = botPlay(questions)
    const winnerId = decideWinner({ uid: me, res: myRes }, { uid: BOT_UID, res: botRes })
    const updated: Match = { ...m, status: 'FINISHED', results: { [me]: myRes, [BOT_UID]: botRes }, winnerId }
    const matches = get().matches.map((x) => (x.id === matchId ? updated : x))
    set({ matches })
    await saveJSON(KEY, matches)
    return updated
  },
}))
