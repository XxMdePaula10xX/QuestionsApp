# Sabido 🧠

Quiz de perguntas e respostas em PT-BR. App mobile (Android/iOS via Capacitor) + web.

> **Status:** Sprint 1 concluído (modo Normal jogável + perfil/XP/streak + FTUE/gate de idade + auth). Veja o [`PRD.md`](./PRD.md) e o parecer de revisão em [`PRD-REVIEW.md`](./PRD-REVIEW.md).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Vite + React 18 + TypeScript |
| UI | Tailwind CSS |
| Estado | Zustand |
| Animações | Framer Motion |
| Roteamento | React Router |
| Empacotamento mobile | Capacitor (Android-first) |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| CI/CD | Codemagic |

## O que o Sprint 0 entrega

- ✅ Scaffold Vite + React + TS + Tailwind, **buildando** (`npm run build`).
- ✅ App navegável (Home, Jogar, Ranking, Perfil, Login) com bottom-nav.
- ✅ Integração Firebase (Auth/Firestore/Storage/Functions) por env vars, com modo *stub* offline quando não configurado.
- ✅ **Estrutura de dados das perguntas**: JSON por categoria + `manifest.json` (com `sha256`) em `public/questions/`, e loader com cache (`src/lib/questionsLoader.ts`).
- ✅ **110 perguntas-amostra** (4 categorias) geradas+validadas por IA — ver ⚠️ abaixo.
- ✅ **Security rules endurecidas** (`firestore.rules`, `storage.rules`) conforme a revisão.
- ✅ **Scaffold das Cloud Functions** com `submitScore` idempotente e gabarito server-side (`functions/src/index.ts`).
- ✅ Config do Capacitor (Android) e pipeline Codemagic (`codemagic.yaml`).

> Sprint 0 é **setup**. O modo Normal completo (pontuação, XP, ranking, validação server-side) é o **Sprint 1+**. A tela "Jogar" hoje é uma **demo** que valida o loader de perguntas end-to-end.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com a config do seu projeto Firebase
npm run dev                  # http://localhost:5173
```

Sem `.env.local` o app roda em modo stub (sem login/backend), mas a navegação e a demo de perguntas funcionam (lendo o bundle local).

Scripts úteis:

```bash
npm run build       # typecheck + build de produção
npm run lint        # ESLint
npm run cap:sync    # build + sincroniza com o projeto nativo
```

### Cloud Functions

```bash
cd functions && npm install && npm run build
```

### Android (após configurar Firebase)

```bash
npm run cap:add:android   # cria a pasta android/ (uma vez)
npm run cap:sync
npx cap open android      # abre no Android Studio
```

## Estrutura

```
public/questions/         # JSON das perguntas + manifest (servido/baixado)
src/
  app/                    # router + layout (bottom-nav, init de auth)
  features/               # telas por domínio (home, play, ranking, profile, auth)
  lib/                    # firebase, loader de perguntas, categorias, config de jogo
  stores/                 # Zustand (authStore)
  types/                  # schema das perguntas + modelos do Firestore
functions/                # Cloud Functions (anti-cheat, pontuação)
firestore.rules           # regras endurecidas (B1/B2/B4 da revisão)
storage.rules             # JSON só p/ autenticados
codemagic.yaml            # CI Android
docs/                     # log de curadoria das perguntas-amostra
```

## ⚠️ Sobre as perguntas-amostra

As 110 perguntas em `public/questions/` foram **geradas por IA** (pipeline gerar→validar adversarial) só para validar o loop do app no Sprint 0. **Não são conteúdo de produção.** Antes de publicar é obrigatório (ver blocker **B5** no `PRD-REVIEW.md`):

- ancorar cada resposta numa **fonte autoritativa** (`source`) — ex.: Wikidata, IBGE;
- amostragem/curadoria humana;
- validador de **família de modelo diferente** do gerador.

Log de curadoria desta amostra: [`docs/sample-questions-curation.md`](./docs/sample-questions-curation.md).

## Decisões adotadas (revisão do PRD, Seção 13)

- Nome: **Sabido** · `appId`: `com.sabido.app`
- Normal: **6** perguntas/partida · Stop: **60s** · Challenge: **10 níveis** (com checkpoints)
- **Android-first**; iOS em sprint posterior (exige conta Apple Developer + Mac).

## Sprint 1 — concluído ✅

- Auth Google + e-mail/senha + convidado, com **gate de idade/LGPD** (B4) e criação de `users/{uid}` + `users/{uid}/private`.
- Modo **Normal** end-to-end (offline-first): categoria → perguntas → feedback + explicação → resultado com pontos/XP.
- Perfil/XP/**nível** + stats por categoria + **streak diário** + **FTUE** (motor de retenção).
- Code-splitting de vendors. Verificado com build + lint + smoke test de browser.

## Próximos passos (Sprint 2)

- Implementar `resolveAnswerKey` + `submitScore` reais (gabarito server-side, B1; idempotência, B3) e reconciliar XP/score com o Firestore.
- Modos competitivos: **Stop** e **Challenge** (sorteio e gabarito server-side).
- Rankings **Global + Por modo** (escrita via Cloud Function) + App Check.
- Loader lendo do **Storage** + cache no **Capacitor Filesystem** + delta updates.
- Expandir a base de perguntas (~1.000+) com fonte autoritativa (B5).
