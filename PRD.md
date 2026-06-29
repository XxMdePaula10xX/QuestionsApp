# PRD — App de Perguntas e Respostas (nome provisório: **Sabido** / **Quiz BR**)

**Autor:** Matheus
**Versão:** 1.0
**Data:** 29/06/2026
**Status:** Aprovado para desenvolvimento (MVP)
**Referência de produto:** Perguntados (Trivia Crack)

---

## 1. Visão geral

Jogo mobile de perguntas e respostas em português (BR), múltipla escolha (4 opções), com modos solo, modos competitivos e desafios assíncronos entre usuários. Inspirado no Perguntados, mas com identidade própria e base de perguntas em PT-BR gerada e curada via IA.

**Proposta de valor:** quiz nacional, com perguntas culturalmente relevantes ao Brasil, ranking social e desafios entre amigos — sem depender de tradução automática de bancos em inglês.

**Plataformas:** Android e iOS (Vite + Capacitor) + web.

---

## 2. Objetivos e métricas de sucesso

| Objetivo | Métrica |
|---|---|
| Engajamento | Sessão média ≥ 3 partidas |
| Retenção D7 | ≥ 25% dos usuários voltam em 7 dias |
| Qualidade das perguntas | Taxa de reporte de erro < 1% das perguntas exibidas |
| Social | ≥ 30% dos usuários ativos iniciam ao menos 1 desafio |
| Build | Publicação nas lojas sem estourar limite (Vite + Codemagic) |

**Não-objetivos do MVP:** multiplayer em tempo real, chat, compra de "vidas", perguntas com imagem/áudio, modo offline para desafios.

---

## 3. Stack técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Front-end | **Vite + React 18 + TypeScript** | Stack dominada pelo autor (Quanto, CatMatch) |
| Empacotamento | **Capacitor** | Publica nas lojas, evita o limite do Expo |
| Backend | **Firebase** (Firestore + Auth + Storage + Cloud Functions) | Experiência prévia do autor |
| Autenticação | **Firebase Auth** (Google + e-mail/senha) | Mesmo padrão do Quanto |
| Perguntas | **JSON versionado** (Firebase Storage / bundle no app) | **NÃO usar Firestore p/ servir perguntas** — custo de leitura. Carregado no device |
| Estado | **Zustand** | Leve, simples |
| UI | **Tailwind CSS** | Velocidade |
| Animações | **Framer Motion** | Feedback de acerto/erro, roleta de categoria |
| CI/CD | **Codemagic** | Pipeline já dominado |

### Arquitetura de dados — princípio-chave

- **Perguntas** vivem em **JSON estático** (por categoria, versionado), baixado do Storage e cacheado no device. Zero custo de leitura por partida, funciona offline nos modos solo.
- **Firestore** guarda só o dinâmico: perfis, partidas assíncronas, rankings, amizades, reports de perguntas.
- **Cloud Functions** validam pontuação no servidor (anti-cheat) e processam ranking — mesmo padrão recomendado no Quanto.

---

## 4. Base de perguntas

### 4.1 Estratégia

- **Não existe banco aberto grande e confiável em PT-BR** (OpenTDB/OpenTriviaQA são em inglês; tradução automática degrada trocadilhos e contexto cultural). Pesquisa confirmou ausência de fonte adequada.
- **Geração via IA + curadoria.** Meta de longo prazo: 30.000 perguntas. **Lançar o MVP com ~5.000 bem curadas** e crescer pelo pipeline. O usuário não percebe a diferença se forem bem distribuídas.

### 4.2 Categorias iniciais (estilo Perguntados, adaptado ao Brasil)

1. **Geografia**
2. **História**
3. **Ciência & Natureza**
4. **Esporte**
5. **Arte & Cultura**
6. **Entretenimento** (cinema, música, TV, games)
7. **Brasil** (coringa: novela, MPB, futebol nacional, política, curiosidades) — diferencial nacional

### 4.3 Dificuldade

Três níveis por pergunta: **Fácil / Médio / Difícil** (usado pelo modo Challenge e pelo balanceamento).

### 4.4 Schema da pergunta (JSON)

```json
{
  "id": "geo_000123",
  "category": "geografia",
  "difficulty": "medio",
  "question": "Qual é a capital da Austrália?",
  "options": ["Sydney", "Canberra", "Melbourne", "Brisbane"],
  "answerIndex": 1,
  "explanation": "Apesar de Sydney ser a maior cidade, a capital é Canberra.",
  "tags": ["capitais", "oceania"],
  "version": 1
}
```

### 4.5 Pipeline de geração (projeto à parte, documentado)

1. **Geração em lote** por categoria + dificuldade via LLM, em JSON estruturado.
2. **Deduplicação**: similaridade textual (embeddings ou hashing) para remover repetidas.
3. **Validação automática**: segundo passe da IA confere se `answerIndex` está factualmente correto e se os distratores são plausíveis mas errados.
4. **Amostragem humana**: revisar amostra por categoria antes de publicar.
5. **Reporte in-app**: usuário sinaliza pergunta errada → fila de curadoria → correção e nova versão do JSON.

> Risco principal do projeto: erro factual mina a confiança. A validação dupla + reporte são obrigatórios, não opcionais.

---

## 5. Modos de jogo

### 5.1 Normal (Clássico / Solo)

- Partida avulsa, sem pressão de tempo (ou tempo generoso).
- Sorteia categoria (roleta estilo Perguntados) ou o usuário escolhe.
- Rodada de N perguntas; mostra acertos ao final.
- Pontuação alimenta XP/nível do perfil.

### 5.2 Stop (Contra o Tempo)

- Quantas perguntas certas em um tempo fixo (ex.: 60s) — ou maior sequência de acertos antes de errar.
- Cada acerto soma; erro encerra ou desconta tempo.
- Pontuação entra em ranking próprio (modo Stop).

### 5.3 Challenge (Escada de Dificuldade)

- Perguntas em dificuldade crescente: começa fácil, sobe até o último nível.
- Errou, acabou (estilo "quem quer ser milionário").
- Recompensa cresce com o nível atingido.
- Ranking próprio: até onde cada um chegou.

### 5.4 Desafio entre usuários (Assíncrono — coração do social)

- Estilo Perguntados/Words with Friends: cada jogador responde seu turno quando quiser.
- Fluxo: usuário A desafia B (amigo ou aleatório) → ambos respondem o **mesmo conjunto de perguntas** → compara acertos/tempo → vencedor.
- Notificação push quando é a vez do jogador (futuro: FCM).
- Sem servidor em tempo real — estado da partida no Firestore.

---

## 6. Ranking

Quatro recortes (todos no MVP):

1. **Global único** — pontuação total acumulada.
2. **Por modo de jogo** — ranking separado de Normal, Stop e Challenge.
3. **Semanal** — reseta toda semana (snapshot via Cloud Function agendada) + global histórico.
4. **Entre amigos** — só quem o usuário segue/adicionou.

**Implementação:** documentos de ranking agregados, atualizados por Cloud Function ao fim da partida (não recalcular lendo todas as partidas). Ranking semanal usa campo `weekId` (ex.: `2026-W27`).

---

## 7. Modelo de dados (Firestore)

```
users/{userId}
  - displayName, photoURL, email
  - level, xp
  - stats: { totalCorrect, totalAnswered, accuracy, gamesPlayed }
  - scores: { global, normal, stop, challenge }
  - createdAt
users/{userId}/friends/{friendUserId}
  - since: timestamp
matches/{matchId}                       // desafio assíncrono
  - players: [userIdA, userIdB]
  - questionIds: string[]               // mesmas perguntas p/ ambos
  - category: string|null
  - status: "WAITING" | "A_DONE" | "B_DONE" | "FINISHED"
  - results: {
      [userId]: { answers: int[], correct: int, timeMs: int, finishedAt }
    }
  - winnerId: string|null
  - createdAt
rankings/{scope}/entries/{userId}       // scope: global | weekly_2026-W27 | normal | stop | challenge
  - displayName, photoURL
  - score: number
  - updatedAt
reports/{reportId}                      // reporte de pergunta errada
  - questionId, userId, reason, createdAt, status
# Perguntas NÃO ficam aqui — JSON no Storage/bundle (ver seção 4)
config/questionsManifest
  - version, categories: [{ id, file, count, version }]
```

---

## 8. Telas e fluxos

### 8.1 Auth
- Login Google + e-mail/senha. Onboarding curto (nome + avatar).

### 8.2 Home
- Botões grandes dos 4 modos.
- Atalho "Seus desafios" (partidas aguardando sua vez) com badge.
- Mini-card da posição no ranking.

### 8.3 Partida (UI central)
- Roleta de categoria (Normal) / contador (Stop) / barra de nível (Challenge).
- Pergunta + 4 opções; feedback visual imediato (verde/vermelho) + explicação opcional.
- Tela de resultado com acertos, pontos e CTA (jogar de novo / desafiar amigo).

### 8.4 Desafios
- Lista de partidas: sua vez / aguardando oponente / finalizadas.
- Iniciar novo: escolher amigo ou oponente aleatório.

### 8.5 Ranking
- Abas: Global / Semanal / Por modo / Amigos.

### 8.6 Perfil
- Nível, XP, precisão por categoria (radar/barras), histórico, amigos.

### 8.7 Reportar pergunta
- Botão discreto na tela da pergunta → motivo → fila de curadoria.

---

## 9. Pontuação e anti-cheat

- **Validação no servidor:** Cloud Function recebe respostas e valida contra o gabarito (o app não decide pontos sozinho). Mesmo princípio do Quanto.
- Fórmula base por acerto: pontos por dificuldade (fácil 100 / médio 200 / difícil 300) + bônus de tempo (Stop) ou multiplicador de nível (Challenge).
- Ranking atualizado por Function ao fim da partida.

---

## 10. Segurança Firestore (resumo)

```
- users/{uid}: read público (perfil); write só o próprio
- matches/{id}: read/write só os 2 players
- rankings/**: read público; write só via Cloud Function (admin)
- reports/**: create por qualquer logado; read/update só admin
```

---

## 11. Roadmap (sprints)

**Sprint 0 — Setup**
- Vite + React + TS + Tailwind; Firebase; Capacitor; pipeline Codemagic validado.
- Estrutura do JSON de perguntas + manifest no Storage.

**Sprint 1 — Núcleo solo + perguntas**
- Auth + perfil.
- Loader de perguntas (JSON do Storage, cache no device).
- Modo **Normal** end-to-end.
- ~1.000 perguntas curadas (2-3 categorias) para validar o loop.

**Sprint 2 — Modos competitivos solo**
- Modo **Stop** e modo **Challenge**.
- Pontuação validada por Cloud Function.
- Rankings Global + Por modo.

**Sprint 3 — Social assíncrono**
- Amizades.
- **Desafio assíncrono** entre usuários.
- Ranking Semanal + Entre amigos.

**Sprint 4 — Conteúdo + polimento + publicação**
- Escalar base para ~5.000 perguntas (todas as 7 categorias) via pipeline.
- Reporte de perguntas + fila de curadoria.
- Empty states, animações, push (FCM) para "sua vez".
- Publicação (lembrar do teste fechado Google Play: 12 testers / 14 dias).

**Pós-MVP:** caminho até 30k perguntas; multiplayer em tempo real; perguntas com imagem.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| **Erro factual nas perguntas** (mata credibilidade) | Validação dupla por IA + amostragem humana + reporte in-app |
| 30k perguntas é muito esforço | Lançar com 5k; pipeline incremental; não travar MVP |
| Custo de leitura do Firestore | Perguntas em JSON estático, fora do Firestore |
| Cheating de pontuação | Validação server-side via Cloud Function |
| Duplicatas na geração | Deduplicação por similaridade no pipeline |
| Teste fechado Google Play (12/14 dias) | Recrutar testers (experiência de Inkly/Meow Crush) |
| Abandono em desafio assíncrono | Timeout: partida expira em X dias, conta como W.O. |

---

## 13. Decisões em aberto (pré-Sprint 0)

1. **Nome do app** — provisórios: *Sabido*, *Quiz BR*, *Cuca*, *Mestre*. Definir.
2. Nº de perguntas por partida no modo Normal (sugestão: 7).
3. Tempo do modo Stop (sugestão: 60s).
4. Nº de níveis do Challenge (sugestão: 10, 1 pergunta por nível subindo dificuldade).
