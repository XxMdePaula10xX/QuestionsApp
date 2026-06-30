import { create } from 'zustand'
import type { CategoryId } from '@/types/question'
import type { Match } from '@/types/models'
import { loadCategories, getQuestionsByIds, shuffle } from '@/lib/questionsLoader'
import { SPRINT0_CATEGORIES } from '@/lib/categories'
import { GAME_CONFIG } from '@/lib/gameConfig'
import { botPlay, decideWinner, scoreAnswers } from '@/lib/matchEngine'
import { loadJSON, saveJSON } from '@/lib/persist'
import { auth } from '@/lib/firebase'

/**
 * Desafios assíncronos — versão LOCAL (offline-first) contra um bot, para tornar
 * o loop social demoável sem backend. Em produção, o mesmo fluxo roda via Cloud
 * Functions (createMatch/submitMatchTurn) com revelação cega server-side (B2);
 * ver functions/src/index.ts. A UI é a mesma.
 */

const KEY = 'matches'
const BOT_UID = 'bot'
const BOT_NAME = 'Robô Sabido 🤖'

function myUid(): string {
  return auth?.currentUser?.uid ?? 'me'
}
function myName(): string {
  return auth?.currentUser?.displayName ?? 'Você'
}

interface MatchState {
  matches: Match[]
  loaded: boolean
  load: () => Promise<void>
  createBotMatch: (category: CategoryId | null) => Promise<Match>
  /** Resolve as perguntas de uma partida (para jogar o turno). */
  resolveQuestions: (matchId: string) => Promise<import('@/types/question').Question[]>
  submitTurn: (matchId: string, answers: number[], timeMs: number) => Promise<Match>
}

async function persist(matches: Match[]) {
  await saveJSON(KEY, matches)
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  loaded: false,

  load: async () => {
    const matches = await loadJSON<Match[]>(KEY, [])
    set({ matches, loaded: true })
  },

  createBotMatch: async (category) => {
    const pool = category ? await loadCategories([category]) : await loadCategories(SPRINT0_CATEGORIES)
    const qs = shuffle(pool).slice(0, GAME_CONFIG.matchQuestionCount)
    const now = Date.now()
    const me = myUid()
    const match: Match = {
      id: `m_${now}_${Math.floor(Math.random() * 1e6)}`,
      players: [me, BOT_UID],
      playerNames: { [me]: myName(), [BOT_UID]: BOT_NAME },
      category,
      questionIds: qs.map((q) => q.id),
      status: 'WAITING', // sua vez
      results: {},
      winnerId: null,
      createdAt: now,
      expiresAt: now + GAME_CONFIG.matchExpiryDays * 86_400_000,
      isBot: true,
    }
    const matches = [match, ...get().matches]
    set({ matches })
    await persist(matches)
    return match
  },

  resolveQuestions: async (matchId) => {
    const m = get().matches.find((x) => x.id === matchId)
    if (!m) throw new Error('Partida não encontrada')
    const from = m.category ? [m.category] : SPRINT0_CATEGORIES
    return getQuestionsByIds(m.questionIds, from)
  },

  submitTurn: async (matchId, answers, timeMs) => {
    const m = get().matches.find((x) => x.id === matchId)
    if (!m) throw new Error('Partida não encontrada')
    const from = m.category ? [m.category] : SPRINT0_CATEGORIES
    const questions = await getQuestionsByIds(m.questionIds, from)
    const me = myUid()

    const myCorrect = scoreAnswers(questions, answers).correct
    const myRes = { correct: myCorrect, total: questions.length, timeMs, finishedAt: Date.now() }
    // Bot joga o seu turno (no online isso já estaria submetido pelo oponente).
    const botRes = botPlay(questions)

    const winnerId = decideWinner({ uid: me, res: myRes }, { uid: BOT_UID, res: botRes })
    const updated: Match = {
      ...m,
      status: 'FINISHED',
      results: { [me]: myRes, [BOT_UID]: botRes },
      winnerId,
    }
    const matches = get().matches.map((x) => (x.id === matchId ? updated : x))
    set({ matches })
    await persist(matches)
    return updated
  },
}))
