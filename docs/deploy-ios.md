# Deploy iOS via Codemagic (sem Mac) — Sabido

Você está no Windows; o build iOS exige macOS + Xcode. O **Codemagic** roda isso na nuvem.
O workflow `ios-release` já está no [`codemagic.yaml`](../codemagic.yaml).

## Pré-requisitos (começar pelos de lead-time)
1. **Apple Developer Program** — US$ 99/ano (aprovação ~1–2 dias). https://developer.apple.com/programs/
2. **App Store Connect**: criar o app com Bundle ID **`com.sabido.app`** e copiar o **App ID numérico** → preencher `APP_STORE_APP_ID` no `codemagic.yaml`.
3. **Conta Codemagic** (codemagic.io) conectada a este repositório.
4. **Política de Privacidade hospedada** numa URL pública (use o conteúdo de [`PRIVACY.md`](../PRIVACY.md)).

## Configuração no Codemagic
1. **App Store Connect API key**: Codemagic → *Teams → Integrations → App Store Connect* → criar uma key (precisa de uma API key gerada no App Store Connect, role Admin/App Manager). Dê o nome **`SabidoASC`** (igual ao `integrations.app_store_connect` do yaml).
2. **Assinatura automática**: o bloco `ios_signing` do workflow usa essa integração para gerar certificados/perfis automaticamente — não precisa subir nada manualmente.
3. **Variáveis** (grupo `firebase`): adicione `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (e `VITE_FIREBASE_VAPID_KEY` se usar push web).
4. **(OPCIONAL — só p/ push nativo, v1.1)** O app v1 usa o **Firebase JS SDK dentro do WebView**, então **NÃO precisa** de `GoogleService-Info.plist` nem APNs para publicar. Quando for ativar push nativo (`@capacitor/push-notifications`), aí sim: adicione um app iOS no Firebase (bundle `com.sabido.app`), suba o `GoogleService-Info.plist` no Codemagic (copiando p/ `ios/App/App/`) e configure a APNs key em Firebase → Cloud Messaging.

## Rodar
- Dispare o workflow **`ios-release`** no Codemagic. Ele: instala deps → build web → `cap add/sync ios` → injeta o Privacy Manifest → gera ícones → assina → builda o IPA → **envia ao TestFlight**.
- Teste no TestFlight; quando aprovado, promova para produção (ligue `submit_to_app_store` ou faça pelo App Store Connect).

## Checklist da ficha (App Store Connect)
- [ ] Nome **Sabido**, subtítulo, descrição PT-BR, palavras-chave (ASO)
- [ ] Screenshots (iPhone 6.7" e 6.5") — use as do app rodando
- [ ] Categoria: Jogos > Trivia; classificação etária (questionário)
- [ ] **App Privacy**: e-mail, nome, identificadores, interação — coerente com o Privacy Manifest e `PRIVACY.md`
- [ ] URL da Política de Privacidade
- [ ] Conta de teste (login e-mail/senha) para a revisão da Apple

## Observações
- **Conteúdo gerado por IA**: as perguntas-amostra ainda precisam de curadoria/fonte antes de produção (a Curadoria-Relâmpago ajuda).
- **App Check**: habilite no Firebase e descomente o `request.app != null` nas rules antes de abrir ao público.
- **Android**: o mesmo repo já tem `android-release` (AAB assinado) para a Google Play.
