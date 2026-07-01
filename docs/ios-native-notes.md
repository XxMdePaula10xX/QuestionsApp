# Notas de build nativo iOS — evitar crash no launch

Histórico: o app crashava no launch no TestFlight. Duas causas foram corrigidas.
Estas regras existem para **não reintroduzir** o problema.

## ⚠️ Regra 1 — NÃO adicionar Firebase NATIVO sem o `GoogleService-Info.plist`
O plugin **`@capacitor-firebase/*`** (ex.: `@capacitor-firebase/messaging`) instala
um pod que **inicializa o Firebase nativo no launch** e exige o arquivo
`GoogleService-Info.plist` dentro do app iOS. Sem o plist → **crash imediato**.

- No **v1** usamos apenas o **SDK web do Firebase** (`firebase/*`), que roda na
  WebView e **não** precisa do plist. Auth, Firestore, Storage e Functions
  funcionam por aí.
- **Push nativo (APNs/FCM) é v1.1.** Só então adicione `@capacitor-firebase/messaging`
  E, no mesmo PR:
  1. baixe o `GoogleService-Info.plist` do Firebase Console (app iOS),
  2. injete-o no build (env base64 no Codemagic → escreve em
     `ios/App/App/GoogleService-Info.plist` num passo do `codemagic.yaml`),
  3. adicione a capability **Push Notifications** + **APNs key**.

## ⚠️ Regra 2 — manter TODOS os `@capacitor/*` na MESMA major (v6)
`@capacitor/ios` deve estar **fixado no `package.json`** na mesma versão do
`@capacitor/core`. Se ele faltar, o `npx cap add ios` no CI instala "na hora" e
pode pegar uma major diferente (v7) → **mismatch nativo → crash no launch**.
Ao subir o Capacitor, suba `core`, `ios`, `android`, `cli` e todos os plugins juntos.

## Regra 3 — só use plugins nativos "config-free" sem checar
Plugins ok sem config extra: `@capacitor/core`, `@capacitor/preferences`,
`@capacitor/filesystem`, `@capacitor/app`. Qualquer plugin que peça
`Info.plist`/entitlement/arquivo de config precisa desse setup **no mesmo PR**.

## Checklist antes de um build iOS
- [ ] `npm run build && npm run lint` verdes
- [ ] Nenhum import de `@capacitor-firebase/*` no `src/` (a menos que o plist esteja no build)
- [ ] `@capacitor/ios` presente no `package.json`, mesma major do `core`
- [ ] `git pull` antes de commitar (branch compartilhado — evita conflito)
