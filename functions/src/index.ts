/**
 * Cloud Functions — Sabido.
 *
 * Anti-cheat / integridade da revisão:
 *  - B1: GABARITO resolvido aqui (lido do Storage), nunca no device.
 *  - B2: desafio assíncrono com REVELAÇÃO CEGA — respostas em subcoleção privada
 *        por jogador; o resultado público só é escrito quando ambos terminam.
 *  - B3: pontuação IDEMPOTENTE (sessionId / submissão única por jogador) em
 *        transação com FieldValue.increment.
 *  - Amizade MÚTUA escrita nos dois lados atomicamente (revisão).
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Transaction } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getMessaging } from 'firebase-admin/messaging'
import { getAuth } from 'firebase-admin/auth'

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 })

type Difficulty = 'facil' | 'medio' | 'dificil'
type GameMode = 'normal' | 'stop' | 'challenge'
const POINTS: Record<Difficulty, number> = { facil: 100, medio: 200, dificil: 300 }
const XP_PER_CORRECT = 10 // XP desacoplado dos pontos de ranking (ver leveling.ts)
const MATCH_QUESTIONS = 5
const MATCH_EXPIRY_MS = 3 * 86_400_000

interface KeyEntry {
  index: number
  difficulty: Difficulty
}
let answerKeyCache: Map<string, KeyEntry> | null = null

async function loadAnswerKey(): Promise<Map<string, KeyEntry>> {
  if (answerKeyCache) return answerKeyCache
  const bucket = getStorage().bucket()
  const [manifestBuf] = await bucket.file('questions/manifest.json').download()
  const manifest = JSON.parse(manifestBuf.toString()) as { categories: { file: string }[] }
  const map = new Map<string, KeyEntry>()
  for (const cat of manifest.categories) {
    const [buf] = await bucket.file(`questions/${cat.file}`).download()
    const file = JSON.parse(buf.toString()) as {
      questions: { id: string; answerIndex: number; difficulty: Difficulty }[]
    }
    for (const q of file.questions) map.set(q.id, { index: q.answerIndex, difficulty: q.difficulty })
  }
  answerKeyCache = map
  return map
}

function weekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function requireAuth(request: CallableRequest): string {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário')
  return uid
}

async function notify(uid: string, title: string, body: string): Promise<void> {
  try {
    const tokensSnap = await db.collection('users').doc(uid).collection('tokens').get()
    const tokens = tokensSnap.docs.map((d) => d.id)
    if (tokens.length === 0) return
    await getMessaging().sendEachForMulticast({ tokens, notification: { title, body } })
  } catch {
    /* push é best-effort */
  }
}

// =================== Pontuação solo (Normal/Stop/Challenge) ===================
interface SubmitScorePayload {
  sessionId: string
  mode: GameMode
  answers: number[]
  questionIds: string[]
}

export const submitScore = onCall<SubmitScorePayload>(async (request) => {
  const uid = requireAuth(request)
  const { sessionId, mode, answers, questionIds } = request.data
  if (!sessionId || !Array.isArray(answers) || !Array.isArray(questionIds)) {
    throw new HttpsError('invalid-argument', 'Payload inválido')
  }
  if (!['normal', 'stop', 'challenge'].includes(mode)) throw new HttpsError('invalid-argument', 'Modo inválido')

  const key = await loadAnswerKey()
  let correct = 0
  let score = 0
  questionIds.forEach((qid, i) => {
    const k = key.get(qid)
    if (k && answers[i] === k.index) {
      correct++
      score += POINTS[k.difficulty]
    }
  })

  const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId)
  const userRef = db.collection('users').doc(uid)
  const wId = weekId()

  return db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef)
    if (sessionSnap.exists && sessionSnap.get('scored') === true) {
      return { alreadyScored: true, score: sessionSnap.get('score') ?? 0, correct: sessionSnap.get('correct') ?? 0 }
    }
    const userSnap = await tx.get(userRef)
    const displayName = (userSnap.get('displayName') as string) ?? 'Jogador'
    const photoURL = (userSnap.get('photoURL') as string | null) ?? null

    tx.set(sessionRef, { scored: true, score, correct, mode, scoredAt: FieldValue.serverTimestamp() })
    tx.update(userRef, {
      [`scores.${mode}`]: FieldValue.increment(score),
      'scores.global': FieldValue.increment(score),
      'stats.totalCorrect': FieldValue.increment(correct),
      'stats.totalAnswered': FieldValue.increment(answers.length),
      'stats.gamesPlayed': FieldValue.increment(1),
      xp: FieldValue.increment(correct * XP_PER_CORRECT),
    })
    const entry = { uid, displayName, photoURL, score: FieldValue.increment(score), updatedAt: FieldValue.serverTimestamp() }
    for (const scope of ['global', mode, `weekly_${wId}`]) {
      tx.set(db.collection('rankings').doc(scope).collection('entries').doc(uid), entry, { merge: true })
    }
    return { alreadyScored: false, score, correct }
  })
})

// =================== Desafio assíncrono ===================
function decideWinner(a: { uid: string; correct: number; timeMs: number }, b: { uid: string; correct: number; timeMs: number }): string | null {
  if (a.correct !== b.correct) return a.correct > b.correct ? a.uid : b.uid
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? a.uid : b.uid
  return null
}

interface CreateMatchPayload {
  opponentUid: string | null // null => aleatório
  category: string | null
}

export const createMatch = onCall<CreateMatchPayload>(async (request) => {
  const uid = requireAuth(request)
  let opponent = request.data.opponentUid
  if (opponent === uid) throw new HttpsError('invalid-argument', 'Não pode desafiar a si mesmo')

  if (!opponent) {
    // Matchmaking aleatório server-side (cliente não escolhe o oponente).
    const candidates = await db.collection('users').limit(20).get()
    const pool = candidates.docs.map((d) => d.id).filter((id) => id !== uid)
    if (pool.length === 0) throw new HttpsError('failed-precondition', 'Sem oponentes disponíveis')
    opponent = pool[Math.floor(Math.random() * pool.length)]
  }

  const key = await loadAnswerKey()
  const ids = [...key.keys()]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  const questionIds = ids.slice(0, MATCH_QUESTIONS)

  const [meSnap, oppSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(opponent).get(),
  ])
  const now = Date.now()
  const ref = db.collection('matches').doc()
  await ref.set({
    players: [uid, opponent],
    playerNames: {
      [uid]: meSnap.get('displayName') ?? 'Jogador',
      [opponent]: oppSnap.get('displayName') ?? 'Jogador',
    },
    category: request.data.category ?? null,
    questionIds,
    status: 'WAITING',
    results: {},
    winnerId: null,
    createdAt: now,
    expiresAt: now + MATCH_EXPIRY_MS,
  })
  await notify(opponent, 'Novo desafio! ⚔️', `${meSnap.get('displayName') ?? 'Alguém'} te desafiou no Sabido.`)
  return { matchId: ref.id, questionIds }
})

interface SubmitTurnPayload {
  matchId: string
  answers: number[]
}

export const submitMatchTurn = onCall<SubmitTurnPayload>(async (request) => {
  const uid = requireAuth(request)
  const { matchId, answers } = request.data
  if (!matchId || !Array.isArray(answers)) throw new HttpsError('invalid-argument', 'Payload inválido')

  const key = await loadAnswerKey()
  const matchRef = db.collection('matches').doc(matchId)
  const mySubRef = matchRef.collection('submissions').doc(uid)

  return db.runTransaction(async (tx: Transaction) => {
    const matchSnap = await tx.get(matchRef)
    if (!matchSnap.exists) throw new HttpsError('not-found', 'Partida não encontrada')
    const match = matchSnap.data() as {
      players: string[]
      questionIds: string[]
      status: string
    }
    if (!match.players.includes(uid)) throw new HttpsError('permission-denied', 'Você não é jogador desta partida')
    if (match.status === 'FINISHED' || match.status === 'EXPIRED') {
      throw new HttpsError('failed-precondition', 'Partida encerrada')
    }

    const otherUid = match.players.find((p) => p !== uid)
    const mySubSnap = await tx.get(mySubRef)
    const otherSubSnap = otherUid ? await tx.get(matchRef.collection('submissions').doc(otherUid)) : null
    if (mySubSnap.exists) return { alreadySubmitted: true } // idempotente (B3)

    // Pontua server-side com o gabarito (B1).
    let correct = 0
    match.questionIds.forEach((qid, i) => {
      const k = key.get(qid)
      if (k && answers[i] === k.index) correct++
    })
    const timeMs = 0 // TODO: medir server-side (revisão) — placeholder.
    tx.set(mySubRef, { answers, correct, timeMs, submittedAt: FieldValue.serverTimestamp() })

    if (otherUid && otherSubSnap && otherSubSnap.exists) {
      // Ambos terminaram → revela resultado (B2).
      const other = otherSubSnap.data() as { correct: number; timeMs: number }
      const total = match.questionIds.length
      const winnerId = decideWinner(
        { uid, correct, timeMs },
        { uid: otherUid, correct: other.correct, timeMs: other.timeMs },
      )
      tx.update(matchRef, {
        status: 'FINISHED',
        winnerId,
        results: {
          [uid]: { correct, total, timeMs, finishedAt: Date.now() },
          [otherUid]: { correct: other.correct, total, timeMs: other.timeMs, finishedAt: Date.now() },
        },
      })
      return { finished: true }
    } else {
      // Primeiro a terminar — NÃO revela nada ao oponente.
      tx.update(matchRef, { status: uid === match.players[0] ? 'A_DONE' : 'B_DONE' })
      return { finished: false }
    }
  })
})

/** Expira desafios parados além do prazo, com W.O. para quem já jogou. */
export const expireMatches = onSchedule('every 6 hours', async () => {
  const now = Date.now()
  const snap = await db
    .collection('matches')
    .where('status', 'in', ['WAITING', 'A_DONE', 'B_DONE'])
    .where('expiresAt', '<', now)
    .limit(200)
    .get()
  const batch = db.batch()
  snap.docs.forEach((doc) => {
    const m = doc.data() as { players: string[]; status: string }
    let winnerId: string | null = null
    if (m.status === 'A_DONE') winnerId = m.players[0]
    else if (m.status === 'B_DONE') winnerId = m.players[1]
    batch.update(doc.ref, { status: 'EXPIRED', winnerId })
  })
  await batch.commit()
})

/** Congela o top da semana anterior (snapshot) — reset é implícito pelo weekId. */
export const weeklyRankingSnapshot = onSchedule('5 0 * * 1', async () => {
  const lastWeek = weekId(new Date(Date.now() - 7 * 86_400_000))
  const top = await db
    .collection('rankings')
    .doc(`weekly_${lastWeek}`)
    .collection('entries')
    .orderBy('score', 'desc')
    .limit(3)
    .get()
  await db.collection('rankings').doc(`weekly_${lastWeek}`).set(
    {
      closed: true,
      winners: top.docs.map((d) => ({ uid: d.id, displayName: d.get('displayName'), score: d.get('score') })),
      closedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
})

// =================== Amizades (mútuas) ===================
export const sendFriendRequest = onCall<{ toUid: string }>(async (request) => {
  const uid = requireAuth(request)
  const toUid = request.data.toUid
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Destino inválido')
  const me = await db.collection('users').doc(uid).get()
  if (!me.exists) throw new HttpsError('failed-precondition', 'Perfil inexistente')
  await db.collection('users').doc(toUid).collection('friendRequests').doc(uid).set({
    fromUid: uid,
    fromName: me.get('displayName') ?? 'Jogador',
    fromUsername: me.get('username') ?? '',
    createdAt: Date.now(),
  })
  await notify(toUid, 'Pedido de amizade 👋', `${me.get('displayName') ?? 'Alguém'} quer ser seu amigo.`)
  return { ok: true }
})

// =================== Exclusão de conta (LGPD art. 18 — blocker B4) ===================
export const deleteAccount = onCall(async (request) => {
  const uid = requireAuth(request)

  // Lê o username reservado ANTES de apagar o doc do usuário (LGPD — libera o handle).
  const userSnap = await db.collection('users').doc(uid).get()
  const username = userSnap.get('username') as string | undefined

  // 1. Remove a amizade do lado dos amigos (relação é mútua).
  const friendsSnap = await db.collection('users').doc(uid).collection('friends').get()
  await Promise.all(
    friendsSnap.docs.map((d) => db.collection('users').doc(d.id).collection('friends').doc(uid).delete().catch(() => {})),
  )

  // 2. Remove as entradas de ranking em todos os escopos.
  const scopes = await db.collection('rankings').listDocuments()
  await Promise.all(scopes.map((s) => s.collection('entries').doc(uid).delete().catch(() => {})))

  // 3. Remove os reportes feitos pelo usuário.
  const reportsSnap = await db.collection('reports').where('uid', '==', uid).get()
  await Promise.all(reportsSnap.docs.map((d) => d.ref.delete().catch(() => {})))

  // 3b. Remove os pedidos de amizade ENVIADOS pelo usuário (ficam na subcoleção
  //     de OUTROS usuários — não são apagados pelo recursiveDelete abaixo).
  try {
    const sent = await db.collectionGroup('friendRequests').where('fromUid', '==', uid).get()
    await Promise.all(sent.docs.map((d) => d.ref.delete().catch(() => {})))
  } catch {
    /* índice de collectionGroup ausente/offline — não bloqueia a exclusão */
  }

  // 3c. Remove as partidas em que o usuário participa (+ submissions), contêm PII do jogo.
  try {
    const matches = await db.collection('matches').where('players', 'array-contains', uid).get()
    await Promise.all(matches.docs.map((d) => db.recursiveDelete(d.ref).catch(() => {})))
  } catch {
    /* índice ausente/offline — não bloqueia a exclusão */
  }

  // 4. Apaga o doc do usuário + subcoleções (private, sessions, friends, tokens, friendRequests).
  await db.recursiveDelete(db.collection('users').doc(uid))

  // 4b. Libera a reserva de username (senão fica órfã e bloqueia o handle para sempre).
  if (username) await db.collection('usernames').doc(username).delete().catch(() => {})

  // 5. Apaga a conta de autenticação.
  await getAuth().deleteUser(uid)

  return { ok: true }
})

export const respondFriendRequest = onCall<{ fromUid: string; accept: boolean }>(async (request) => {
  const uid = requireAuth(request)
  const { fromUid, accept } = request.data
  const reqRef = db.collection('users').doc(uid).collection('friendRequests').doc(fromUid)
  const reqSnap = await reqRef.get()
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Pedido inexistente')

  if (accept) {
    const [a, b] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('users').doc(fromUid).get()])
    const now = Date.now()
    const batch = db.batch()
    batch.set(db.collection('users').doc(uid).collection('friends').doc(fromUid), {
      uid: fromUid,
      displayName: b.get('displayName') ?? 'Jogador',
      username: b.get('username') ?? '',
      photoURL: b.get('photoURL') ?? null,
      since: now,
    })
    batch.set(db.collection('users').doc(fromUid).collection('friends').doc(uid), {
      uid,
      displayName: a.get('displayName') ?? 'Jogador',
      username: a.get('username') ?? '',
      photoURL: a.get('photoURL') ?? null,
      since: now,
    })
    batch.delete(reqRef)
    await batch.commit()
  } else {
    await reqRef.delete()
  }
  return { ok: true, accepted: accept }
})

// =================== #5 Pergunta do Dia Nacional ===================
export const answerDaily = onCall<{ date: string; questionId: string; answerIndex: number }>(async (request) => {
  const uid = requireAuth(request)
  const { date, questionId, answerIndex } = request.data
  if (!date || !questionId) throw new HttpsError('invalid-argument', 'Payload inválido')
  const key = await loadAnswerKey()
  const correct = key.get(questionId)?.index === answerIndex

  const ansRef = db.collection('users').doc(uid).collection('dailyAnswers').doc(date)
  const aggRef = db.collection('daily').doc(date)
  return db.runTransaction(async (tx) => {
    const ans = await tx.get(ansRef)
    const agg = await tx.get(aggRef)
    let total = (agg.get('total') as number) ?? 0
    let corr = (agg.get('correct') as number) ?? 0
    if (!ans.exists) {
      tx.set(ansRef, { questionId, correct, at: FieldValue.serverTimestamp() })
      tx.set(aggRef, { questionId, total: FieldValue.increment(1), correct: FieldValue.increment(correct ? 1 : 0), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      total += 1
      corr += correct ? 1 : 0
    }
    return { total, correct: corr, pctCorrect: total ? Math.round((corr / total) * 100) : 0 }
  })
})

// =================== #2 Desafio Aberto (1-para-muitos) ===================
function pickQuestionIds(key: Map<string, KeyEntry>, n: number): string[] {
  const ids = [...key.keys()]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, n)
}

export const createOpenMatch = onCall<{ category: string | null }>(async (request) => {
  const uid = requireAuth(request)
  const key = await loadAnswerKey()
  const me = await db.collection('users').doc(uid).get()
  const now = Date.now()
  const ref = db.collection('matches').doc()
  await ref.set({
    players: [uid],
    playerNames: { [uid]: me.get('displayName') ?? 'Jogador' },
    category: request.data.category ?? null,
    questionIds: pickQuestionIds(key, MATCH_QUESTIONS),
    status: 'WAITING',
    results: {},
    winnerId: null,
    open: true,
    createdAt: now,
    expiresAt: now + MATCH_EXPIRY_MS,
  })
  return { matchId: ref.id }
})

export const joinOpenMatch = onCall<{ matchId: string }>(async (request) => {
  const uid = requireAuth(request)
  const ref = db.collection('matches').doc(request.data.matchId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpsError('not-found', 'Desafio não encontrado')
    const m = snap.data() as { players: string[]; open?: boolean }
    if (!m.open) throw new HttpsError('failed-precondition', 'Este desafio não é aberto')
    if (m.players.includes(uid)) return { matchId: request.data.matchId, already: true }
    if (m.players.length >= 2) throw new HttpsError('failed-precondition', 'Este desafio já tem oponente')
    const me = await tx.get(db.collection('users').doc(uid))
    tx.update(ref, {
      players: [...m.players, uid],
      [`playerNames.${uid}`]: me.get('displayName') ?? 'Jogador',
      open: false,
    })
    return { matchId: request.data.matchId }
  })
})

// =================== #6 Brasileirão de Quiz (ligas) ===================
const LEAGUE_TIERS = 5 // 0=Várzea ... 4=Libertadores
/** Atribui ligas pela posição relativa no ranking semanal (percentil). */
export const weeklyLeagueUpdate = onSchedule('10 0 * * 1', async () => {
  const lastWeek = weekId(new Date(Date.now() - 7 * 86_400_000))
  const snap = await db.collection('rankings').doc(`weekly_${lastWeek}`).collection('entries').orderBy('score', 'desc').get()
  const n = snap.size
  if (n === 0) return
  // Commit em lotes de 400 (limite de 500 escritas por batch do Firestore).
  let batch = db.batch()
  let count = 0
  const commits: Promise<unknown>[] = []
  snap.docs.forEach((d, i) => {
    const percentile = 1 - i / n // 1 = topo
    const tier = Math.min(LEAGUE_TIERS - 1, Math.floor(percentile * LEAGUE_TIERS))
    batch.set(db.collection('users').doc(d.id), { league: tier, leagueWeek: lastWeek }, { merge: true })
    if (++count >= 400) {
      commits.push(batch.commit())
      batch = db.batch()
      count = 0
    }
  })
  if (count > 0) commits.push(batch.commit())
  await Promise.all(commits)
})

// =================== #10 Curadoria-Relâmpago ===================
const REPORT_THRESHOLD = 3
/** Agrega reportes; suspende perguntas acima do limiar e enfileira pra curadoria. */
export const aggregateReports = onSchedule('0 */6 * * *', async () => {
  const snap = await db.collection('reports').where('status', '==', 'aberto').get()
  const byQuestion = new Map<string, { reporters: Set<string>; reasons: Record<string, number> }>()
  snap.docs.forEach((d) => {
    const r = d.data() as { questionId: string; uid: string; reason: string }
    const e = byQuestion.get(r.questionId) ?? { reporters: new Set(), reasons: {} }
    e.reporters.add(r.uid)
    e.reasons[r.reason] = (e.reasons[r.reason] ?? 0) + 1
    byQuestion.set(r.questionId, e)
  })
  const suspended: string[] = []
  let batch = db.batch()
  let count = 0
  const commits: Promise<unknown>[] = []
  for (const [questionId, e] of byQuestion) {
    if (e.reporters.size < REPORT_THRESHOLD) continue
    suspended.push(questionId)
    batch.set(
      db.collection('curation').doc(questionId),
      { questionId, reporters: e.reporters.size, reasons: e.reasons, status: 'suspenso', updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    if (++count >= 400) {
      commits.push(batch.commit())
      batch = db.batch()
      count = 0
    }
    // TODO(LLM-juiz): com uma API de LLM, revalidar fato + unicidade e propor
    // enunciado/answerIndex/explanation corrigidos para aprovação em 1 clique,
    // incrementando `version`. Requer chave de API (não incluída no repo).
  }
  // Índice de suspensas lido pelo cliente para excluir do pool (best-effort).
  batch.set(db.collection('curation').doc('_index'), { suspended, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  commits.push(batch.commit())
  await Promise.all(commits)
})

// =================== Username editável e único (reserva transacional) ===================
export const changeUsername = onCall<{ username: string }>(async (request) => {
  const uid = requireAuth(request)
  const raw = (request.data.username || '').trim().toLowerCase()
  if (!/^[a-z0-9_]{3,15}$/.test(raw)) {
    throw new HttpsError('invalid-argument', 'Use 3 a 15 caracteres: letras minúsculas, números ou _')
  }
  // Já usado por outro perfil? (captura também usernames antigos não-reservados)
  const existing = await db.collection('users').where('username', '==', raw).limit(1).get()
  if (!existing.empty && existing.docs[0].id !== uid) {
    throw new HttpsError('already-exists', 'Esse nome de usuário já está em uso')
  }

  const userRef = db.collection('users').doc(uid)
  const newRef = db.collection('usernames').doc(raw)
  return db.runTransaction(async (tx) => {
    const me = await tx.get(userRef)
    if (!me.exists) throw new HttpsError('failed-precondition', 'Perfil inexistente')
    const resv = await tx.get(newRef)
    if (resv.exists && resv.get('uid') !== uid) {
      throw new HttpsError('already-exists', 'Esse nome de usuário já está em uso')
    }
    const old = me.get('username') as string | undefined
    tx.set(newRef, { uid })
    tx.update(userRef, { username: raw })
    if (old && old !== raw) tx.delete(db.collection('usernames').doc(old))
    return { username: raw }
  })
})
