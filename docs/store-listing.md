# Checklist de publicação — Sabido

## Pré-requisitos de conta (lead time!)
- [ ] Conta **Google Play Console** (US$ 25, única vez)
- [ ] Conta **Apple Developer** (US$ 99/ano) — só quando for fazer iOS
- [ ] **Keystore** Android gerado e guardado em local seguro (NÃO commitar)
- [ ] Política de Privacidade publicada em **URL pública** (ver `PRIVACY.md`)

## Build de release (Android)
- [ ] `appId` definido: `com.sabido.app`
- [ ] Ícones e splash gerados (192/512 + adaptativo)
- [ ] `versionCode`/`versionName` definidos
- [ ] Build assinado via Codemagic (workflow `android-release`) — ver `codemagic.yaml`
- [ ] Variáveis de ambiente `VITE_FIREBASE_*` configuradas no Codemagic

## Ficha da loja (Play)
- [ ] Nome: **Sabido**
- [ ] Descrição curta e completa (PT-BR)
- [ ] Screenshots (telefone) — pode usar as do diretório de QA
- [ ] Categoria: Jogos > Trivia
- [ ] Classificação etária (questionário de conteúdo)
- [ ] **Data Safety**: declarar e-mail, nome, dados de jogo, token FCM (coerente com `PRIVACY.md`)
- [ ] Seção **Famílias** se mirar < 13 anos

## App Privacy (Apple, quando for iOS)
- [ ] Declarações de privacidade equivalentes ao Data Safety
- [ ] APNs key configurada (também usada pelo push)

## Teste fechado (Google Play)
- [ ] Recrutar **12 testers** e manter o teste por **14 dias** (requisito atual para contas novas)
- [ ] Link de inscrição no grupo de teste distribuído
- [ ] Coletar feedback / corrigir crashes antes da produção

## Conteúdo
- [ ] Substituir perguntas-amostra de IA por conteúdo curado com **fonte autoritativa** (blocker B5)
- [ ] Fila de curadoria de reportes operando (coleção `reports`)
