# Configuração do Firebase — Sabido (passo a passo)

Guia para habilitar login, banco, rankings, desafios e push. O app roda **offline no modo convidado** sem nada disso; siga aqui quando quiser as features online.

> ⚠️ **Plano Blaze é necessário para as Cloud Functions** (pontuação validada, rankings, desafios, exclusão de conta). O Blaze é "pague conforme o uso", mas tem uma cota grátis generosa — para teste você praticamente não paga. Login por e-mail/senha, criação de perfil e "esqueci a senha" funcionam **sem** Functions (só com Auth + Firestore).

---

## 1. Criar o projeto
1. Acesse https://console.firebase.google.com → **Adicionar projeto**.
2. Nome: `sabido` (ou o que quiser). Pode desativar o Google Analytics.

## 2. Registrar o app Web e pegar a config
1. No projeto → ícone **</>** (Web) → registre o app (apelido "Sabido Web").
2. O console mostra um objeto `firebaseConfig`. Copie os valores para um arquivo **`.env.local`** na raiz do projeto (copie de `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
3. `npm run dev` de novo → a tela de login deixa de mostrar "Firebase não configurado".

## 3. Authentication (login por e-mail/senha)
1. Menu **Build → Authentication → Começar**.
2. Aba **Sign-in method** → habilite **E-mail/senha** → salvar.
3. (O reset de senha já funciona: o Firebase envia o e-mail de redefinição automaticamente.)

## 4. Firestore (banco)
1. **Build → Firestore Database → Criar banco de dados**.
2. Escolha **modo de produção** e a região **`southamerica-east1`** (São Paulo) — a mesma das Functions.

## 5. Storage (perguntas + avatares)
1. **Build → Storage → Começar** (mesma região).

## 6. Instalar a CLI e logar
```bash
npm install -g firebase-tools
firebase login
firebase use --add        # escolha o projeto que você criou; apelido: default
```

## 7. Publicar regras e índices
Da raiz do projeto (já existem `firestore.rules`, `storage.rules`, `firestore.indexes.json`):
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 8. Subir as perguntas para o Storage
A Cloud Function lê o gabarito do Storage (server-side). Suba os JSONs:
```bash
# precisa do gsutil (vem com o Google Cloud SDK) OU use o botão "Upload" no console:
gsutil -m cp -r public/questions gs://SEU_BUCKET/questions
```
> No console: **Storage → Upload** a pasta `public/questions` inteira para `questions/`.
> O nome do bucket é o `VITE_FIREBASE_STORAGE_BUCKET` (ex.: `sabido.appspot.com`).

## 9. Cloud Functions (requer plano Blaze)
1. **Configurações do projeto → Faturamento → mudar para Blaze** (pede cartão; cota grátis cobre testes).
2. Deploy:
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
   Isso publica: `submitScore`, `createMatch`, `submitMatchTurn`, `expireMatches`,
   `weeklyRankingSnapshot`, `sendFriendRequest`, `respondFriendRequest`, `deleteAccount`.

## 10. (Opcional) App Check — anti-abuso
1. **Build → App Check** → registre o app Web com **reCAPTCHA v3** → copie o site key.
2. Em `.env.local`: `VITE_RECAPTCHA_V3_SITE_KEY=...`

## 11. (Opcional) Push / FCM
1. **Configurações → Cloud Messaging** → gere uma **Web Push certificate (VAPID)**.
2. Em `.env.local`: `VITE_FIREBASE_VAPID_KEY=...`
3. Edite `public/firebase-messaging-sw.js` preenchendo o `firebaseConfig` (os mesmos valores).

---

## Resumo do que funciona em cada nível
| Sem Firebase | Só Auth+Firestore (grátis) | Com Blaze (Functions) |
|---|---|---|
| Modo convidado, todos os modos offline, bot | + Login e-mail/senha, perfil, reset de senha | + Pontuação validada, rankings, desafios reais, amizades, **excluir conta**, push |

## Teste rápido pós-configuração
1. `npm run dev` → crie uma conta (e-mail/senha) → confira no console (Authentication + Firestore `users/{uid}`).
2. Jogue uma partida Normal → veja `scores`/`xp` subirem em `users/{uid}` (precisa das Functions).
3. Em outro navegador/perfil, crie outra conta e teste o desafio entre os dois.
