# Auditoria ULTRACODE — Sabido

_Auditoria pré-release em 10 dimensões (arquitetura, correção, backend/segurança, persistência, auth, React/frontend, UI/UX, performance mobile, acessibilidade, prontidão de loja). Cada achado verificado adversarialmente. 21 agentes._

## Veredito

NÃO LIBERADO para QA externa nem para as lojas. 6 bloqueadores P0 precisam ser resolvidos antes de qualquer envio a testers. Bloqueadores: (A) perda de progresso do usuário — cluster de 3 causas-raiz (persist.ts Preferences-first, race no load() do profileStore, fallback EMPTY destrutivo) que reproduz exatamente o bug relatado; enviar para QA sem corrigir isto gera relatos de "perdi tudo" impossíveis de investigar. (B) segurança competitiva — gabarito no device + submitScore sem validação anulam todo o anti-cheat server-side; qualquer conta autenticada sobe ao topo do ranking. (C) conteúdo — 3.268 perguntas de IA não verificadas (B5). Recomendação: corrigir o cluster de persistência PRIMEIRO (é o de maior risco e o mais provável de aparecer em QA), com um teste de fumaça manual de "jogar → fechar app → reabrir" em device nativo real (iOS e Android) antes de reabrir para QA. Os P1 devem ser corrigidos antes do QA externo; os P2 antes da submissão às lojas.

## Resumo executivo

O app "Sabido" compila e passa typecheck/lint/build, mas NÃO está pronto para QA externa nem publicação. A auditoria de 10 dimensões confirmou 6 bloqueadores P0. O BUG ATIVO relatado ("ao terminar a partida não salva a pontuação e mostra que zerei todas as perguntas") foi confirmado e tem TRÊS causas-raiz independentes que se somam, todas reais no código: (1) assimetria de persistência em persist.ts — saveJSON grava localStorage síncrono primeiro e Preferences depois, mas loadJSON LÊ Preferences primeiro, então um snapshot antigo/durável mascara o localStorage fresco e a última partida some; (2) race no profileStore.load() — o guard `if(loaded)return` é avaliado antes do await e o set() pós-await é incondicional, então um load em voo disparado no boot do AppLayout sobrescreve o progresso recém-gravado por recordGameResult/markSeen, zerando XP/stats e revertendo o array `seen` (perguntas voltam a ser inéditas); (3) fallback EMPTY em falha transitória de leitura — se o Preferences corromper/falhar, loadJSON adota EMPTY como verdade e a PRÓXIMA partida grava esse vazio por cima das duas camadas, tornando a perda permanente. Fixar uma das três não elimina o sintoma; as três precisam ser corrigidas juntas. Além da perda de dados, o modelo competitivo está totalmente quebrado: o gabarito (answerIndex) é enviado ao device no bundle e no Storage, e o submitScore não valida quantidade/unicidade/vínculo de sessão, permitindo inflar score arbitrariamente e ler o gabarito como oráculo — todo ranking/liga/desafio é trivialmente burlável. Por fim, as 3.268 perguntas são 100% geradas por IA sem fonte autoritativa (blocker B5 já reconhecido pelo próprio time), com erros factuais já detectados na amostra curada. A camada de conformidade de loja (política de privacidade só rascunho, declarações de dados divergentes entre plataformas, conflito de classificação etária, build Android com ícone genérico e versionCode não incremental) também bloqueia submissão.

## Pontos fortes

- Arquitetura offline-first coerente: tudo funciona como convidado e recursos online exigem login — bom para o público-alvo Android mid/low-end.
- Scoring competitivo desenhado como server-side (Cloud Function) com a INTENÇÃO correta de não deixar o cliente escrever score; a estrutura existe, faltou fechar a validação e não vazar o gabarito.
- PII isolada em subdoc privado e carimbo de aceite de termos/idade previstos — a base de conformidade LGPD está esboçada.
- deleteAccount já remove a maior parte dos dados (friends, ranking, reports, recursiveDelete do user) — falta só fechar os órfãos.
- Idempotência server-side por sessionId já implementada na transação (só precisa amarrar o sessionId ao servidor).
- Padrão bom de loading/error/retry no RankingScreen que pode ser reaproveitado nas demais telas online.
- typecheck, lint e build passam de forma limpa; toolchain (Vite/TS/Tailwind/Capacitor 6) e esteira CI (codemagic) já montados.
- Cobertura ampla de modos de jogo (Normal, Stop, Challenge, Desafio assíncrono, Sala, Diária, Ligas, Conquistas, Amigos) — escopo de produto rico e em grande parte funcional.

## P0 — Bloqueadores (6)

### P0.1 — Perda de progresso (causa-raiz 1): loadJSON lê Preferences primeiro, mas saveJSON grava localStorage primeiro — leitura mascara o dado fresco
- **Área:** arquitetura/persistencia
- **Local:** `src/lib/persist.ts:33-60`
- **Impacto:** saveJSON grava localStorage síncrono (l.54) e só depois `await Preferences.set` (l.56); loadJSON lê Preferences primeiro (l.36) e só cai no localStorage se Preferences==null (l.41). A partir da 2ª partida o Preferences já tem valor antigo; se o WKWebView for suspenso/morto antes do flush do Preferences, no próximo boot o Preferences VELHO é lido e o localStorage fresco é ignorado. A partida seguinte regrava sobre o estado velho, destruindo o dado bom. Reproduz literalmente 'ao terminar a partida não salva a pontuação'.
- **Correção:** Na leitura, escolher a camada MAIS NOVA: gravar um contador/timestamp monotônico `_v`/`_ts` no envelope e comparar em loadJSON (merge determinístico), OU tornar o localStorage a fonte primária de leitura (síncrono, sempre reflete a última gravação) usando o Preferences só como backup quando o localStorage estiver vazio. Adicionar flush do Preferences em eventos de pausa (App 'pause'/visibilitychange 'hidden').

### P0.2 — Perda de progresso (causa-raiz 2): race no profileStore.load() — set() incondicional pós-await sobrescreve o progresso recém-salvo
- **Área:** correcao-jogo/react
- **Local:** `src/stores/profileStore.ts:85-92`
- **Impacto:** O guard `if(get().loaded)return` (l.88) é avaliado ANTES do `await loadJSON` (l.89); o `set({profile:stored,loaded:true})` (l.91) é incondicional após o await. AppLayout dispara loadProfile() fire-and-forget no boot (AppLayout.tsx:31, sem await). Enquanto esse load [A] está suspenso no bridge nativo (loaded=false), markSeen (l.137) no start do jogo e recordGameResult (l.97) no fim chamam load() de novo [B] — o guard também passa. Se [B] grava a partida e depois [A] resolve, o set incondicional da l.91 descarta a partida e reconstrói seenRef a partir do seen ANTIGO. Reverte XP/stats e esvazia seen ('zerei todas as perguntas'). Janela alarga no cold start nativo (intermitência = o 'às vezes' relatado).
- **Correção:** Tornar load() single-flight: guardar a Promise em andamento no store e fazer todos os chamadores aguardarem a MESMA promise (um único loadJSON, um único set). Re-checar `if(get().loaded)return` também DEPOIS do await, antes do set (l.91). Idealmente aguardar loadProfile() no AppLayout antes de liberar o jogo.

### P0.3 — Perda de progresso (causa-raiz 3): fallback EMPTY em falha transitória de leitura vira perda PERMANENTE no próximo save
- **Área:** persistencia-offline
- **Local:** `src/stores/profileStore.ts:85 / src/lib/persist.ts:41-47`
- **Impacto:** Se Preferences.get lança/indisponível E lsGet==null, OU se JSON.parse falha com raw NÃO-nulo (valor truncado/corrompido no Preferences), loadJSON devolve EMPTY. No caminho de parse-falha (persist.ts:45-47) o localStorage NEM é consultado (o fallback do localStorage só roda quando raw==null, l.41), então um valor corrompido no Preferences descarta um localStorage íntegro. load() adota EMPTY como verdade (loaded=true) e a PRÓXIMA partida (recordGameResult, l.97) grava EMPTY+1 nas DUAS camadas — dano irreversível. Casa com 'zerei tudo'.
- **Correção:** Distinguir 'sem dado' de 'falha ao ler': no catch do parse, TENTAR o localStorage antes de devolver fallback; se qualquer camada lançar exceção, NÃO adotar EMPTY nem permitir sobrescrever (manter loaded=false / modo somente-leitura e reler). Validar shape mínimo antes de aceitar o perfil. Manter backup rotativo (profile.bak) nunca sobrescrito quando o load veio de fallback.

### P0.4 — Gabarito (answerIndex) enviado ao device no bundle e no Storage — anula todo o anti-cheat server-side
- **Área:** backend-seguranca
- **Local:** `src/lib/questionsLoader.ts:84,92,148 / storage.rules:9`
- **Impacto:** O loader entrega o objeto Question COMPLETO ao cliente, incluindo answerIndex/explanation (question.ts:32-33). public/questions/*.json contém answerIndex em texto puro e storage.rules:9 libera read de questions/** para qualquer autenticado. PublicQuestion/toPublicQuestion existem mas NUNCA são usados no loader. Qualquer jogador conhece a resposta certa de todas as perguntas e pode responder 100% correto em submitScore/submitMatchTurn/answerDaily — ranking global/semanal, ligas do Brasileirão e desafios ficam trivialmente burláveis. O comentário 'GABARITO nunca no device' (index.ts:5) é factualmente falso.
- **Correção:** Gerar dois artefatos: público (PublicQuestion, sem answerIndex/explanation) para bundle e Storage do cliente, e privado (com gabarito) num prefixo/bucket sem read público, acessível só ao Admin SDK das Functions. Retornar a explanation pela Function após a submissão. Enquanto o gabarito estiver no device, nenhuma validação server-side tem valor anti-cheat.

### P0.5 — submitScore não valida quantidade/unicidade de questionIds nem vincula à sessão real — inflação de score e oráculo de gabarito
- **Área:** backend-seguranca
- **Local:** `functions/src/index.ts:100-134`
- **Impacto:** answers[] e questionIds[] vêm direto do cliente; o forEach (l.100-106) só soma pontos por acerto, sem limite de tamanho, dedup de ids nem verificação de sessão server-side. O sessionId é gerado NO CLIENTE (scoreService.ts:28-31,55), então cada payload novo cria sessão nova e a idempotência (l.114) não deduplica. A função retorna {score,correct} (l.134) funcionando como oráculo, e stats.totalAnswered usa answers.length controlado pelo atacante. Enviar questionIds=[qid_dificil ×1000] com respostas certas devolve score=300000 e leva ao topo do ranking; enviar sessões de 1 pergunta revela cada gabarito.
- **Correção:** Criar sessão server-side (startSession que sorteia e persiste questionIds+expiração); em submitScore validar que o sessionId existe/pertence ao uid, ainda não foi pontuado, questionIds === os sorteados (mesmo conjunto), length===MATCH_QUESTIONS e sem repetição. Não retornar gabarito nem contagem detalhada antes de encerrar.

### P0.6 — As 3.268 perguntas são 100% geradas por IA sem fonte autoritativa (blocker B5 não resolvido)
- **Área:** release-store
- **Local:** `public/questions/manifest.json (+ 7 JSONs)`
- **Impacto:** Os 7 JSONs somam 3.268 perguntas, todas com source='amostra-ia' e ZERO com sourceUrl/verifiedAt. A curadoria humana documentada cobre só 110 perguntas e o próprio doc diz 'NÃO é conteúdo de produção'. store-listing.md:32 e PRD-REVIEW.md:53 marcam como blocker B5. Erros factuais reais já foram pegos só nas 110 amostradas (ex.: Tancredo Neves 'voto direto'). Um quiz que ensina fatos errados em escala gera enxurrada de reportes, reviews 1-estrela e risco de reprovação nas duas lojas; QA de conteúdo fica sem sentido.
- **Correção:** Não publicar com source='amostra-ia'. Definir fonte autoritativa por categoria, estender schema com sourceUrl/verifiedAt, validar closed-book (modelo de família diferente) + open-book contra a fonte + curadoria humana amostral. Interinamente, reduzir o conteúdo publicado ao subconjunto realmente curado (~110) em vez de shippar 3.268 não verificadas.

## P1 — Corrigir antes da QA (19)

### P1.1 — Modo Normal: next() sem guarda de reentrância — toque duplo conta partida em dobro e pontua duas sessões no servidor
- **Área:** correcao-jogo
- **Local:** `src/features/play/useNormalGame.ts:69 / PlayScreen.tsx:103`
- **Impacto:** next() é async sem guarda e o botão não é desabilitado durante o await; na última pergunta não há early return. Dois toques rápidos executam submitScore+recordGameResult duas vezes → gamesPlayed/XP/acertos em dobro localmente. Como newSessionId() gera id novo a cada chamada, a idempotência server-side (index.ts:113-116) não deduplica — o servidor pontua DUAS sessões. Fácil de disparar em mobile.
- **Correção:** Guarda de reentrância em next() (ref advancing/finishedRef com early return) e/ou desabilitar o botão enquanto submitScore/recordGameResult estão em andamento (phase 'submitting').

### P1.2 — Flash de progresso ZERADO a cada cold start — Home/Perfil renderizam perfil EMPTY antes do load assíncrono
- **Área:** ui-ux
- **Local:** `src/app/AppLayout.tsx:31,43,47`
- **Impacto:** O Outlet renderiza imediatamente; só o Ftue é gated em profileLoaded. O profileStore inicia EMPTY/loaded=false e só chama load() no useEffect (após o primeiro paint), aguardando Preferences.get (ponte nativa). No cold start a Home mostra 'Nível 1/0 dias/XP vazio' e o Perfil 'Convidado/0 partidas' por 50-200ms+. Mesmo sem perda real, comunica perda de dados a cada abertura e reforça a percepção do bug relatado.
- **Correção:** Gate as telas dependentes do perfil em profileLoaded com skeleton/shimmer enquanto loaded===false, OU hidratar o profileStore SÍNCRONO do localStorage na criação do store (antes do primeiro paint), reconciliando depois com Preferences.

### P1.3 — Cadastro grava displayName e PII (idade/aceite LGPD) em background sem retry — some para sempre em caso de falha
- **Área:** auth-sync
- **Local:** `src/stores/authStore.ts:63-70 / src/lib/userRepo.ts:53`
- **Impacto:** signUpWithEmail dispara `void (async ()=>{updateProfile; ensureProfile(cred.user,onboarding)})()` NÃO aguardado. Se falhar no WKWebView, birthYear e acceptedTermsAt nunca são gravados. No relaunch, onAuthStateChanged chama ensureProfile SEM onboarding, e a PII só grava quando onboarding está presente — logo NUNCA é reescrita. birthYear do cadastro não é persistido localmente para retry. Usuário pode ficar sem age-gate (COPPA) e sem carimbo de aceite (LGPD não comprovável), e perder o displayName (cai em 'Jogador').
- **Correção:** Persistir o onboarding (birthYear/aceite) localmente no cadastro e, no ensureProfile do onAuthStateChanged, reprocessar a PII pendente quando o subdoc private ainda não existir. Reaplicar displayName no relaunch. Telemetrar a falha em vez de só console.warn.

### P1.4 — Perfil local não é namespaced por uid e não há merge convidado→conta — contas vazam dados em device compartilhado
- **Área:** auth-sync
- **Local:** `src/lib/userRepo.ts:34-46 / src/stores/profileStore.ts:46`
- **Impacto:** A KEY de persistência é a constante literal 'profile' (sem uid); signOut só faz fbSignOut, sem hook de logout no profileStore. Dois testers de QA no mesmo device (ou convidado→login→logout→outro login) compartilham xp/seen/bests/achievements/statsByCategory. Além disso ensureProfile cria o perfil no Firestore ZERADO e o progresso local do convidado nunca é mesclado — quem jogou como convidado aparece zerado no ranking. Reforça a sensação de 'dados errados/zerados'.
- **Correção:** Namespacear a KEY por uid (`profile:${uid??'guest'}`) e recarregar/limpar o profileStore no onAuthStateChanged (relaxando o guard `loaded`). No 1º login, migrar/oferecer merge do progresso do convidado uma única vez.

### P1.5 — Lost-update: markSeen (void) e recordGameResult gravam o MESMO blob 'profile' e podem reverter a pontuação do último jogo
- **Área:** auth-sync
- **Local:** `src/stores/profileStore.ts:135 / useStopGame.ts:93`
- **Impacto:** markSeen e recordGameResult fazem read-modify-write independentes sobre o mesmo blob, cada um com seu `await saveJSON`. No Stop, `void markSeen([q.id])` dispara muito perto do finish→recordGameResult; se o Preferences.set do markSeen (snapshot com stats velhas) resolver DEPOIS do recordGameResult, o Preferences fica com stats velhas e o próximo launch devolve o snapshot sem o jogo. Perda INTERMITENTE da pontuação (o sintoma 'não salva a pontuação'; NÃO zera as perguntas por esta via).
- **Correção:** Serializar as escritas do profileStore numa fila (writeChain=writeChain.then(...)) e encadear markSeen na mesma fila em vez de `void`. Alternativa: mover `seen` para chave própria fora do blob de stats. Corrigir a leitura Preferences-first (P0) neutraliza a maior parte do risco.

### P1.6 — App Check não é exigido em nenhuma Cloud Function nem nas rules — callables abertos a scripts fora do app
- **Área:** backend-seguranca
- **Local:** `functions/src/index.ts:23,89 / firestore.rules:11 / src/lib/firebase.ts:48`
- **Impacto:** Nenhum onCall usa enforceAppCheck; rules têm apenas 'TODO(Sprint 2)'. No cliente, App Check só inicializa quando platform==='web' — sem cobertura nativa iOS/Android. Todas as callables (submitScore, createMatch, deleteAccount, answerDaily…) e leituras Firestore/Storage podem ser chamadas por scripts com um token de usuário, amplificando os P0 (automação de cheating), abuso/DoS de custo em southamerica-east1 e scraping do gabarito.
- **Correção:** Habilitar enforceAppCheck nas callables sensíveis e exigir request.app!=null nas rules de escrita. No nativo, configurar App Attest/DeviceCheck (iOS) e Play Integrity (Android) — não o SDK web reCAPTCHA. Habilitar enforcement só DEPOIS de ter provider nativo, senão o app nativo é bloqueado.

### P1.7 — deleteAccount deixa dados órfãos (LGPD + requisito de loja): username, friendRequests enviados e matches não são limpos
- **Área:** backend-seguranca
- **Local:** `functions/src/index.ts:319-343 / 537-543`
- **Impacto:** recursiveDelete só alcança subcoleções de users/{uid}. Ficam órfãos: (a) usernames/{handle} (top-level) — o handle fica reservado para sempre e a rule proíbe escrita pelo cliente, bloqueando reuso via 'already-exists'; (b) friendRequests que o usuário ENVIOU (vivem em users/{outro}/friendRequests/{uid}); (c) matches com playerNames/displayName do excluído. Exclusão de conta incompleta sob LGPD art.18 (blocker B4 no próprio código) e requisito obrigatório de App Store/Google Play.
- **Correção:** No deleteAccount: ler o username ANTES do recursiveDelete e apagar usernames/{handle}; varrer users onde exista friendRequests/{uid} e apagar; anonimizar/encerrar matches em que o uid participa.

### P1.8 — Nenhum Error Boundary / errorElement — um throw em render deixa o app sem recuperação amigável
- **Área:** react-frontend
- **Local:** `src/app/router.tsx:25`
- **Impacto:** createBrowserRouter não define errorElement e não há ErrorBoundary em lugar nenhum (grep=0). Qualquer exceção no render (dado inesperado do Firestore, questão malformada, options de tamanho diferente) sobe sem captura e o React Router mostra sua tela de erro genérica em inglês, sem 'Voltar ao início' em PT-BR nem recarregar. Risco alto em QA externa e review de loja, onde dispositivos/dados variados expõem casos ausentes no dev.
- **Correção:** Adicionar errorElement na rota raiz e/ou um ErrorBoundary envolvendo o <Outlet/> no AppLayout, com mensagem PT-BR, botão voltar/recarregar e log para telemetria.

### P1.9 — submitTurn do desafio online sem try/catch: falha de rede mostra 'Respostas enviadas' e descarta a jogada
- **Área:** react-frontend
- **Local:** `src/features/challenges/MatchPlayScreen.tsx:60-68`
- **Impacto:** Em next() (última pergunta), setSubmitted(true) (l.67) é chamado ANTES de `await submitTurn` (l.68), sem try/catch. Se submitTurn rejeitar (comum no WKWebView), há unhandled rejection e o componente já renderiza 'Respostas enviadas!' (l.129) — a jogada fica só no state local e é descartada. No fluxo core competitivo, instabilidade de rede faz o jogador ver 'enviado' quando nada foi. Recuperação existe (remontar), mas não é óbvia.
- **Correção:** Envolver submitTurn em try/catch; só setar submitted=true após sucesso. Em erro, reverter (setSubmitted(false)), exibir mensagem e permitir reenviar. Aplicar a mesma proteção ao caminho do bot.

### P1.10 — Sem code-splitting por rota: todas as 18 telas carregam no boot
- **Área:** mobile-perf
- **Local:** `src/app/router.tsx:3-18`
- **Impacto:** router.tsx importa TODAS as telas estaticamente; grep por lazy/Suspense=vazio. O index chunk (~31KB gz) traz o código de todas as telas no cold start mesmo abrindo só a Home, e a ausência de splitting é o que mantém firebase(456KB)/motion(115KB) no modulepreload do boot. First paint atrasado em Android mid/low-end (público-alvo).
- **Correção:** Converter rotas não-críticas para React.lazy()+<Suspense>, mantendo só Home/AppLayout no bundle inicial. Combinar com lazy-init do Firebase e das telas com framer-motion para tirar esses vendors do modulepreload do index.html.

### P1.11 — Firebase inicializado no boot, quebrando o design offline-first
- **Área:** mobile-perf
- **Local:** `src/lib/firebase.ts:38-80 / src/app/AppLayout.tsx:29-39`
- **Impacto:** firebase.ts inicializa initializeApp/AppCheck/Auth/Firestore/Storage/Functions na avaliação do módulo; AppLayout chama initAuth()/initMatches() no useEffect de boot, forçando o chunk firebase (~107KB gz só o principal + init de 4 SDKs) antes de o convidado responder a primeira pergunta, mesmo 100% offline. Maior parcela isolada do payload de boot; atinge tempo de abertura e memória inicial no WebView de aparelhos fracos.
- **Correção:** Lazy-init: expor getFirebase()/getDb()/getFunctions() com `await import('firebase/...')` sob demanda, acionado só em recursos online (login, ranking, salas, desafios). AppLayout não deve chamar initAuth no boot incondicionalmente.

### P1.12 — Zoom desativado globalmente (user-scalable=no / maximum-scale=1.0) — WCAG 1.4.4 e risco de reprovação na App Store
- **Área:** acessibilidade
- **Local:** `index.html:5`
- **Impacto:** A meta viewport contém 'maximum-scale=1.0, user-scalable=no'. O WKWebView (iOS) respeita e bloqueia pinch-to-zoom. Combinado com abuso de tamanhos mínimos (text-xs, text-[10px]), usuário com baixa visão não consegue ampliar perguntas/alternativas. Violação direta de WCAG 1.4.4 e item recorrente em revisão de acessibilidade da App Store.
- **Correção:** Remover 'maximum-scale=1.0, user-scalable=no', mantendo 'width=device-width, initial-scale=1.0, viewport-fit=cover'. Garantir font-size>=16px nos inputs para evitar zoom-on-focus no iOS.

### P1.13 — Acerto/erro sinalizado só por cor + ícones aria-hidden — leitor de tela e daltônicos sem feedback (WCAG 1.4.1/4.1.2)
- **Área:** acessibilidade
- **Local:** `src/features/play/PlayScreen.tsx:80-92 (+ Stop/Challenge/Daily/Room)`
- **Impacto:** O resultado é só cor de fundo (verde/vermelho) e os ✓/✗ estão com aria-hidden; não há aria-live. Usuário de VoiceOver/TalkBack responde e não recebe informação de acerto/erro — o núcleo do jogo fica inacessível. Daltônicos (verde×vermelho é o pior par) não distinguem a alternativa correta. Atinge Normal, Stop, Challenge, Diária e Sala (esta sem nem o ícone).
- **Correção:** Rótulo acessível dinâmico após responder (aria-label 'Resposta correta'/'Sua resposta, incorreta') e região aria-live=assertive anunciando o resultado. Reforçar com borda/ícone visível além da cor; não usar aria-hidden nos ✓/✗ quando forem a única pista.

### P1.14 — Contraste insuficiente: text-gray-400 (~2.5:1) e text-gray-300 (~1.6:1) em texto funcional — WCAG 1.4.3
- **Área:** acessibilidade
- **Local:** `src/app/AppLayout.tsx:60 (+ ~15 arquivos)`
- **Impacto:** gray-400 (#9ca3af, ~2.5:1) é usado em nav inativa, links 'Sair'/'Início' de todas as telas de jogo, contador de progresso, dificuldade, XP p/ próximo nível e rótulos de Stat; gray-300 (~1.6:1) em texto real (MatchPlayScreen:110). Todos abaixo do mínimo AA 4.5:1. Sob luz do dia ficam ilegíveis; como 'Sair' é a saída principal e o contador é gameplay, o impacto é funcional.
- **Correção:** Trocar gray-400 por gray-500 (~4.8:1) no mínimo para todo texto informativo; gray-600/700 onde couber. Eliminar gray-300 em texto. Definir tokens no tailwind.config.js para não recair no gray-400.

### P1.15 — Campos de formulário sem rótulo (só placeholder) e sem autocomplete — WCAG 1.3.1/3.3.2/4.1.2
- **Área:** acessibilidade
- **Local:** `src/features/auth/LoginScreen.tsx:118-146 (+ Room/Friends/Ftue)`
- **Impacto:** Inputs de e-mail/senha/nome/ano usam só placeholder, sem <label>/aria-label e sem autoComplete. Leitor de tela anuncia campo sem nome estável (placeholder some ao digitar); a falta de autoComplete/type prejudica gerenciadores de senha, aumentando erro e abandono no login — tela crítica de conversão.
- **Correção:** Adicionar <label> associado (ou aria-label) a cada input e autoComplete apropriado (email, current-password/new-password, name). Placeholder apenas como exemplo, nunca como único rótulo.

### P1.16 — Política de privacidade só existe como rascunho markdown; loja exige URL pública e revisão jurídica
- **Área:** release-store
- **Local:** `PRIVACY.md:5 / docs/store-listing-aso.md:79`
- **Impacto:** PRIVACY.md se auto-declara 'Rascunho operacional... revise com jurídico antes de publicar e hospede numa URL pública'. A URL github.io apontada serve como suporte+privacidade, mas nada no repo comprova que está publicada nem coerente com o texto atual. Sem URL pública ativa a submissão é bloqueada de imediato nas duas lojas; rascunho sem revisão jurídica, em app que coleta PII de possíveis menores, é exposição LGPD.
- **Correção:** Publicar a política numa URL pública estável, revisar com jurídico, garantir texto hospedado idêntico ao PRIVACY.md e preencher a URL de suporte. Só então submeter.

### P1.17 — Declarações de dados divergem entre PRIVACY.md, Data Safety (Play) e App Privacy (Apple) — e anunciam dados que o app não coleta
- **Área:** release-store
- **Local:** `PRIVACY.md:13,17 / resources/PrivacyInfo.xcprivacy / docs/store-listing-aso.md:118-128`
- **Impacto:** (1) PRIVACY.md anuncia 'foto (se login Google)' e README diz 'Auth Google', mas grep=ZERO signInWithPopup/GoogleAuthProvider — só e-mail/senha existe (declara coleta inexistente). (2) FCM: PRIVACY.md/store-listing.md mandam declarar FCM no Data Safety, mas o xcprivacy e o App Privacy da Apple listam só Email/Name/UserID/ProductInteraction — as duas lojas recebem declarações diferentes. (3) push nativo 'chega na v1.1', logo declarar FCM na v1.0 é impreciso. Declarações incoerentes são causa comum de pendência no Data Safety/App Privacy e falha LGPD.
- **Correção:** Alinhar PRIVACY.md, Data Safety e App Privacy ao que a v1.0 realmente coleta: remover login Google/foto (ou implementar), decidir se FCM entra só na v1.1 e refletir nas três fontes, declarar 'ID de usuário' de forma idêntica nas duas lojas.

### P1.18 — Conflito de classificação etária: app permite <13 via checkbox self-attest e tem recursos sociais, mas declara 'não é para crianças'
- **Área:** release-store
- **Local:** `src/features/onboarding/Ftue.tsx:11,38-39,74-77 / docs/store-listing-aso.md:115`
- **Impacto:** MIN_AGE_NO_CONSENT=13 e canFinish libera <13 apenas marcando 'Tenho a permissão dos meus pais' (self-attestation fraca). Simultaneamente declara à Apple/Google 'não é para crianças (tem recursos sociais)' mirando Livre/4+. Mas o app tem interação entre usuários (Desafios, Salas, Amigos). Permitir <13 + recursos sociais aciona Target Audience/Famílias no Play (reprovação) e possível pendência na Apple; fragilidade LGPD art.14 (consentimento verificável, não checkbox).
- **Correção:** Escolher postura coerente: bloquear de fato <13 (público 13+, declarando interação entre usuários) OU entrar no programa Famílias com os controles exigidos. Ajustar ficha e gate para não se contradizerem.

### P1.19 — Build Android não gera ícone/splash nativos nem incrementa versionCode — AAB sai com ícone genérico e sobe uma vez só
- **Área:** release-store
- **Local:** `codemagic.yaml:22-62,108`
- **Impacto:** '@capacitor/assets generate' só existe no workflow iOS; os jobs Android só fazem cap add/sync e nunca geram assets. android/ é gitignored e recriada do zero a cada build → o .aab sai com ícone/splash PADRÃO do Capacitor (sinal de app 'template'). Além disso bundleRelease não define versionCode/versionName; com android/ regenerada, o versionCode fica sempre 1 — e o Play REJEITA AAB com versionCode duplicado, quebrando toda atualização a partir do 2º envio (beira P0).
- **Correção:** Adicionar 'npx @capacitor/assets generate' (sem --ios) aos jobs Android antes do gradlew e injetar versionCode incremental (-PversionCode=$BUILD_NUMBER, -PversionName=...) no bundleRelease. Idealmente versionar android/ ou o config de assets.

## P2 — Antes das lojas (33)

### P2.1 — Array `seen` cresce e reescreve o blob inteiro do perfil (localStorage+Preferences) a cada pergunta apresentada
- **Área:** arquitetura/persistencia
- **Local:** `src/stores/profileStore.ts:143,145`
- **Correção:** Persistir `seen` em chave própria e compacta (append/FIFO, limitado a N ids — preferUnseen já libera o pool quando esgota) para não reserializar todo o blob de stats a cada draw. Isso reduz a write-amplification que agrava o cluster P0.

### P2.2 — Fallback offline pontua localmente mas a 'reconciliação depois' prometida no comentário não existe — pontos nunca chegam ao ranking
- **Área:** arquitetura
- **Local:** `src/lib/scoreService.ts:61-63`
- **Correção:** Implementar de fato a fila de reconciliação (persistir sessões não confirmadas e reenviar submitScore ao voltar a rede), OU marcar o resultado offline como explicitamente não-ranqueado na UI. Centralizar a regra de pontuação num módulo puro (hoje vive em scoreLocally, matchEngine e na Function).

### P2.3 — Gravações concorrentes na mesma chave 'profile' não são serializadas — Preferences pode resolver fora de ordem
- **Área:** persistencia-offline
- **Local:** `src/lib/persist.ts:50-60 / src/stores/profileStore.ts:94`
- **Correção:** Serializar as escritas do perfil com uma fila (promise chain) por chave, garantindo que a última gravação lógica seja a última a atingir o Preferences. Amplificador do P0 — corrigir a leitura mais-nova neutraliza boa parte.

### P2.4 — Sem versionamento/migração de schema; merge raso deixa stats/statsByCategory/streak crus do storage
- **Área:** persistencia-offline
- **Local:** `src/stores/profileStore.ts:90`
- **Correção:** Adicionar `version` ao envelope persistido e migração explícita no load. Merge profundo/normalização defensiva de stats/statsByCategory/streak; coerção Number(x)||0 nos incrementos para blindar contra undefined/null em builds futuros.

### P2.5 — matchStore.init substitui a lista pelo snapshot do Firestore ao logar — partidas locais (bot) do convidado somem da UI
- **Área:** persistencia-offline
- **Local:** `src/stores/matchStore.ts:71-86`
- **Correção:** Mesclar as partidas locais do convidado (localStorage 'matches') com o snapshot online ao logar, ou migrá-las, com política clara sobre partidas de bot. É perda de VISIBILIDADE (o localStorage permanece), não de dados.

### P2.6 — Regra de criação de /users não restringe stats e league — perfil novo pode forjar estatísticas e liga máxima
- **Área:** backend-seguranca
- **Local:** `firestore.rules:31-37`
- **Correção:** No allow create, exigir também stats (todos os contadores)==0 e league==0/ausente, ou usar hasOnly() para fixar exatamente o conjunto de chaves permitido na criação.

### P2.7 — displayName/photoURL sem validação — impersonação e conteúdo ofensivo propagados para ranking/matches
- **Área:** backend-seguranca
- **Local:** `firestore.rules:40-41`
- **Correção:** Validar no rule (tamanho máximo, photoURL restrita ao domínio do próprio Storage) e/ou moderar displayName via Function. Esses valores são copiados para rankings/entries e matches.playerNames, lidos publicamente.

### P2.8 — Funções agendadas fazem leituras sem limite (custo/DoS em escala)
- **Área:** backend-seguranca
- **Local:** `functions/src/index.ts:459,484,262`
- **Correção:** Paginar com limit+cursor (startAfter) em weeklyLeagueUpdate e aggregateReports; para expireMatches (limit 200 sem loop), iterar até esvaziar; teto de reports por execução. aggregateReports é alimentado por usuários (vetor de custo).

### P2.9 — answerDaily aceita questionId arbitrário, não vinculado à Pergunta do Dia oficial
- **Área:** backend-seguranca
- **Local:** `functions/src/index.ts:379-401`
- **Correção:** Derivar a pergunta oficial do dia no servidor (mesma função determinística do cliente) e exigir questionId===oficial de date; validar date==hoje (UTC) e formato. Hoje o usuário escolhe qualquer pergunta fácil (ou cujo gabarito conhece) para acertar.

### P2.10 — submitScore em jogo pode ficar pendurado sem timeout, atrasando/impedindo o recordGameResult
- **Área:** auth-sync
- **Local:** `src/lib/scoreService.ts:45-65 / useNormalGame.ts:76`
- **Correção:** Envolver a callable num Promise.race com timeout (8-10s) caindo para scoreLocally; e/ou gravar recordGameResult local ANTES/independentemente do submitScore (o local é a fonte de verdade da UI), reconciliando o servidor em segundo plano. Sem timeout, pode travar ~70s a tela de resultado.

### P2.11 — XP exibido no resultado (+pontos) diverge do XP realmente aplicado (acertos×10)
- **Área:** correcao-jogo/ui
- **Local:** `src/features/play/PlayScreen.tsx:150-151`
- **Correção:** Exibir na linha de XP o valor real xpForCorrect(summary.correct) (10 por acerto), separando 'Pontos (ranking)' de 'XP (nível)'. Hoje 4 acertos fáceis mostram 'XP +400' mas o nível recebe +40, minando a confiança na progressão.

### P2.12 — Race de navegação: criar/entrar em desafio navega antes do onSnapshot incluir a partida → pisca 'Desafio não encontrado'
- **Área:** react-frontend
- **Local:** `src/features/challenges/ChallengesScreen.tsx:33,48 / MatchPlayScreen.tsx:40`
- **Correção:** Em MatchPlayScreen, quando loaded && !match, mostrar 'Preparando desafio...' por um curto período em vez de NotFound imediato; ou aguardar o match aparecer no store antes de navegar. Afeta só caminhos online.

### P2.13 — AchievementToast descarta conquistas quando várias são desbloqueadas de uma vez (mostra só a primeira)
- **Área:** react-frontend/ui
- **Local:** `src/features/achievements/AchievementToast.tsx:9,13 / profileStore.ts:83,128`
- **Correção:** Desenfileirar item a item (set(s=>({justUnlocked:s.justUnlocked.slice(1)}))) a cada timeout/clique, em vez de set({justUnlocked:[]}) que esvazia a fila inteira. Primeira partida costuma desbloquear várias — perde-se o momento de recompensa/retenção.

### P2.14 — Perfil usa <a href> em vez de <Link> para o login (reload total do WebView)
- **Área:** ui-ux
- **Local:** `src/features/profile/ProfileScreen.tsx:134`
- **Correção:** Trocar por <Link to="/login">, consistente com RankingScreen:99. O <a href> recarrega o bundle e reinicializa auth/profile/match stores no app empacotado, com flash branco e re-disparo do flash de progresso zerado.

### P2.15 — Contagem de 'sua vez' diverge entre Home (WAITING) e barra de navegação (needsMyTurn)
- **Área:** ui-ux
- **Local:** `src/features/home/HomeScreen.tsx:30 / AppLayout.tsx:27`
- **Correção:** Reutilizar needsMyTurn(m, myUid) também na Home. needsMyTurn é superset de WAITING (cobre A_DONE/B_DONE por uid), então os dois badges divergem na mesma tela quando é a vez do usuário após o oponente jogar.

### P2.16 — DailyScreen pode ficar preso em 'Carregando...' para sempre (sem estado de erro)
- **Área:** ui-ux
- **Local:** `src/features/daily/DailyScreen.tsx:8 / dailyStore.ts:36-51`
- **Correção:** Adicionar try/catch no load() e um estado de erro com mensagem PT-BR e botão 'Tentar de novo'. Se loadCategory lançar, set({loaded:true}) nunca roda e a Pergunta do Dia (gancho de retenção destacado na Home) vira dead-end.

### P2.17 — MatchPlayScreen quebra (tela branca) se as perguntas resolvidas vierem vazias
- **Área:** ui-ux
- **Local:** `src/features/challenges/MatchPlayScreen.tsx:46,48,85`
- **Correção:** Tratar questions.length===0 explicitamente com tela de erro e link para /desafios; checar q (undefined) antes de renderizar q.id/q.question. O guard só trata null; [] é truthy e leva a TypeError em ids desatualizados após update de conteúdo.

### P2.18 — Sair no meio de uma partida descarta o progresso sem confirmação (pior no Stop cronometrado)
- **Área:** ui-ux
- **Local:** `src/features/stop/StopScreen.tsx:16 (+ Play/Challenge)`
- **Correção:** Pedir confirmação quando phase==='playing' ('Sair encerra a partida e você perde os pontos desta rodada'), ou mover/estilizar o 'Sair' para reduzir toques acidentais no topo. No Stop a pontuação só grava no finish.

### P2.19 — Faltam @capacitor/splash-screen e @capacitor/status-bar — risco de flash branco na abertura
- **Área:** mobile-perf
- **Local:** `capacitor.config.ts:8 / package.json`
- **Correção:** Adicionar @capacitor/splash-screen (launchAutoHide:false) e chamar SplashScreen.hide() após o primeiro render no main.tsx; adicionar @capacitor/status-bar para fixar style/overlays. Sem o plugin runtime não há controle do hide, e o boot pesado abre janela para flash branco.

### P2.20 — capacitor.config.ts sem iosScheme e sem config iOS apesar do alvo App Store
- **Área:** mobile-perf/release
- **Local:** `capacitor.config.ts:8`
- **Correção:** Se iOS entra neste ciclo: tornar a config explícita (iosScheme:'capacitor', backgroundColor), rodar cap add ios + smoke test em device real (App Check nativo, deep links, cookies). Não deixar entre dois estados (comentário diz 'sprint posterior' mas o brief mira App Store).

### P2.21 — framer-motion (38KB gz) no boot para animações triviais
- **Área:** mobile-perf
- **Local:** `src/features/home/HomeScreen.tsx:77`
- **Correção:** Substituir por transições CSS/Tailwind e remover framer-motion do bundle inicial; ou lazy-load as telas que o usam. Home importa motion estaticamente, colocando o chunk (115KB) no boot crítico do modulepreload.

### P2.22 — backdrop-blur na bottom-nav fixed pode causar jank de scroll no Android
- **Área:** mobile-perf
- **Local:** `src/app/AppLayout.tsx:51`
- **Correção:** Trocar por fundo opaco (bg-white) sem backdrop-blur — correção trivial e sem custo visual relevante. Impacto real device-dependent (PLAUSÍVEL), mas o custo de corrigir é baixo.

### P2.23 — outline-none remove o foco visível dos inputs sem substituto — WCAG 2.4.7
- **Área:** acessibilidade
- **Local:** `src/features/auth/LoginScreen.tsx:123 (+ Room/Friends/Ftue) / index.css:28-40`
- **Correção:** Remover outline-none ou acrescentar focus-visible:ring-2 focus-visible:ring-brand-500 nos inputs e nas classes .btn do index.css (contraste do anel >=3:1). Usuários de teclado externo (iPad)/Switch Control não veem o campo focado.

### P2.24 — Alvos de toque abaixo de 44x44 (e de 24px) em ações importantes — WCAG 2.5.8
- **Área:** acessibilidade
- **Local:** `src/features/play/PlayScreen.tsx:14 (+ headers, ProfileScreen, LoginScreen, Friends)`
- **Correção:** Aumentar a área tocável para >=44x44 com padding (ex.: -m-2 p-2 nos links de cabeçalho, py-2/py-3 nos botões de texto). 'Sair' (~20px) é a saída principal das telas de jogo e 'Excluir conta' é destrutivo.

### P2.25 — Estado ativo da bottom-nav diferenciado só por cor — WCAG 1.4.1
- **Área:** acessibilidade
- **Local:** `src/app/AppLayout.tsx:59-61`
- **Correção:** Adicionar um segundo indicador visual ao item ativo (barra/ponto, peso de fonte ou fundo) além da cor, e usar um cinza que passe 4.5:1 no inativo. aria-current já vem do NavLink.

### P2.26 — Barras de progresso sem semântica acessível (role/aria-value) — WCAG 1.3.1/4.1.2
- **Área:** acessibilidade
- **Local:** `src/features/play/PlayScreen.tsx:50-54 (+ Home XP, Stop timer, Profile, Conquistas)`
- **Correção:** Envolver com role=progressbar + aria-valuenow/valuemin/valuemax, ou associar valor textual via aria-live quando relevante. Inclui o timer do Stop, sensível ao tempo, hoje invisível para leitor de tela.

### P2.27 — Bottom-sheet e overlay de tutorial sem semântica de diálogo / gestão de foco — WCAG 4.1.2/2.4.3
- **Área:** acessibilidade
- **Local:** `src/features/play/ReportButton.tsx:26 / src/features/onboarding/Ftue.tsx:46`
- **Correção:** Aplicar role=dialog + aria-modal=true + aria-labelledby, mover foco ao abrir e devolver ao fechar, prender o foco, fechar com Esc e marcar o fundo como inert/aria-hidden. O FTUE contém o gate de idade LGPD e é o primeiro contato.

### P2.28 — Controles só com emoji/ícone sem nome acessível; badges numéricos sem rótulo — WCAG 1.1.1/4.1.2
- **Área:** acessibilidade
- **Local:** `src/app/AppLayout.tsx:64-68 / HomeScreen.tsx:40-42,83-85`
- **Correção:** Marcar emojis decorativos com aria-hidden; dar aria-label aos badges ('3 desafios na sua vez'); dar aria-label ao Link do avatar ('Abrir perfil'). Hoje o leitor anuncia 'emoji+rótulo' e o link do perfil sem propósito.

### P2.29 — Erros de formulário e status assíncronos não são anunciados (sem aria-live) — WCAG 4.1.3/3.3.1
- **Área:** acessibilidade
- **Local:** `src/features/auth/LoginScreen.tsx:187-188 (+ Ranking/Friends/Room)`
- **Correção:** Colocar erros em container role=alert (aria-live=assertive) e avisos de sucesso/carregamento em aria-live=polite; associar erro do input via aria-describedby. Usuário cego não ouve por que o login falhou nem que o link foi copiado.

### P2.30 — Alturas fixas de card + ausência de text-size-adjust podem cortar texto ampliado — WCAG 1.4.4/1.4.10
- **Área:** acessibilidade
- **Local:** `src/features/home/HomeScreen.tsx:79 (+ Play/Stop/Challenge)`
- **Correção:** Preferir min-h em vez de h fixo (h-32/h-28/h-7) nesses cards e testar a 200% de fonte. Depende do zoom (bloqueado pelo P1 de viewport), então corrigir junto.

### P2.31 — Ficha da App Store instrui a declarar conteúdo como 'curado' — declaração imprecisa
- **Área:** release-store
- **Local:** `docs/store-listing-aso.md:89`
- **Correção:** Ajustar a redação para não afirmar 'curadas' até a curadoria real existir (ex.: 'conteúdo factual próprio, sem reproduzir obras de terceiros'). Alinha-se naturalmente quando o P0 de conteúdo for resolvido.

### P2.32 — Fonte Inter declarada no design mas nunca carregada — tipografia cai para system-ui, divergindo entre iOS e Android
- **Área:** release-store
- **Local:** `tailwind.config.js:32`
- **Correção:** Decidir conscientemente: self-host Inter (woff2 + @font-face, sem CDN por causa de WKWebView/App Check) e confirmar carregamento, OU remover 'Inter' do config e assumir system-ui como escolha de design. Não há nenhum arquivo de fonte em public/.

### P2.33 — Sem indicação global de offline e tratamento de erro inconsistente entre telas
- **Área:** release-store/ui
- **Local:** `src/features/ranking/RankingScreen.tsx:47`
- **Correção:** Adicionar indicador global de offline (listener em navigator.onLine — hoje ZERO usos) e um estado de erro/retry consistente para telas que dependem de rede, reaproveitando o padrão do RankingScreen. QA e review de loja testam com rede ruim.

## P3 — Melhorias (19)

### P3.1 — resetProgress grava EMPTY com ftueDone:false — 'Zerar progresso local' reativa o onboarding
- **Área:** arquitetura/ux
- **Correção:** Preservar `ftueDone` em resetProgress (mesclar EMPTY mantendo o ftueDone atual) e tornar o guard `loaded` controlável (flag force) para permitir reload em relogin/reset. (profileStore.ts:88,157)

### P3.2 — Stop: último acerto nos ~100ms finais pode não contar (stale-closure em finish)
- **Área:** correcao-jogo
- **Correção:** Manter score/correct/answered também em refs e ler os refs dentro de finish(), desacoplando a gravação do ciclo de render. Raro (janela de ~1 render no último tick). (useStopGame.ts:37-49)

### P3.3 — Challenge: fallback pode repetir a mesma pergunta em níveis diferentes
- **Área:** correcao-jogo
- **Correção:** Selecionar o fallback a partir de um pool restante (all menos as já escolhidas) com cursor próprio, garantindo unicidade por partida. Afeta pools pequenos. (useChallengeGame.ts:74)

### P3.4 — Modo Normal marca as 6 perguntas como vistas no START — abandono queima perguntas sem crédito
- **Área:** correcao-jogo
- **Correção:** Marcar como vista somente ao apresentar/responder cada pergunta (como o Stop faz no pick), em vez de marcar o lote no start. Agrava esgotamento do catálogo. (useNormalGame.ts:47)

### P3.5 — submitMatchTurn com timeMs fixo em 0 — desempate por tempo nunca ocorre
- **Área:** backend-seguranca
- **Correção:** Medir o tempo server-side (timestamp de entrega das perguntas → delta na submissão) ou aceitar timeMs do cliente com limites; ajustar decideWinner. Hoje empates de acertos terminam winnerId=null. (index.ts:233)

### P3.6 — answerKeyCache nunca invalidado e parâmetro category ignorado nas Functions
- **Área:** backend-seguranca
- **Correção:** Invalidar answerKeyCache por TTL/versão do manifest; filtrar questionIds por category quando informado. Após corrigir uma pergunta via curadoria o cache pode divergir por horas; desafio 'de categoria' sorteia qualquer categoria. (index.ts:36,164,405)

### P3.7 — load() check-then-act (StrictMode) dispara loads redundantes no boot
- **Área:** persistencia-offline
- **Correção:** Guardar a Promise do load em andamento e retorná-la nas chamadas concorrentes (single-flight). Benigno hoje (ambos convergem ao mesmo estado), mas o mesmo fix cobre a causa-raiz 2 do P0. (profileStore.ts:85-91)

### P3.8 — onAuthStateChanged engole todos os erros de ensureProfile silenciosamente
- **Área:** auth-sync
- **Correção:** Logar/telemetrar a falha (Crashlytics/console com código) e sinalizar 'perfil pendente' para reprocessar. Hoje um usuário fica logado sem perfil no Firestore de forma invisível, dificultando diagnóstico em QA. (authStore.ts:39-44)

### P3.9 — resolveQuestions marca perguntas como 'seen' ao abrir a tela do desafio (mesmo sem jogar)
- **Área:** react-frontend
- **Correção:** Marcar como seen apenas ao submeter o turno, não ao abrir a tela. Opcionalmente flag de unmount no efeito. Reduz o pool de inéditas antes da hora. (MatchPlayScreen.tsx:30 / matchStore.ts:148)

### P3.10 — RoomScreen assina o store inteiro, re-renderizando a cada mudança de qualquer jogador
- **Área:** react-frontend
- **Correção:** Selecionar apenas os campos usados via seletores (useRoomStore(s=>...)) ou useShallow e memoizar sub-componentes de lista. Jank em salas Kahoot grandes no WebView fraco. (RoomScreen.tsx:9)

### P3.11 — Estado vazio do Ranking exibe o id interno da aba na copy ('Ranking global/stop/challenge')
- **Área:** ui-ux
- **Correção:** Usar o label amigável da aba (TABS.find(t=>t.id===tab)?.label) em vez do id cru. Aparência de placeholder técnico numa tela vista na fase inicial. (RankingScreen.tsx:124)

### P3.12 — Stop: penalidade de tempo por erro não tem feedback visual
- **Área:** ui-ux
- **Correção:** Mostrar micro-feedback ao errar (badge '-Ns' vermelho animado junto ao relógio). Hoje o relógio 'pula' para baixo sem explicação, parecendo bug. (useStopGame.ts:102)

### P3.13 — Busca de amigos sem login mostra 'Ninguém encontrado' enganoso em vez de pedir login
- **Área:** ui-ux
- **Correção:** Quando !user, mostrar 'Entre para adicionar amigos' com link de login e desabilitar a busca; capturar o erro de permissão. Hoje o convidado conclui que a pessoa não usa o app. (FriendsScreen.tsx:55,160)

### P3.14 — Afordância de voltar inconsistente entre telas (rótulo e destino variam)
- **Área:** ui-ux
- **Correção:** Padronizar um componente de header com botão de voltar consistente. 'Sair'/'Início'/'Perfil'/'Ranking' divergem por tela e o WKWebView não oferece swipe-back. (ConquistasScreen.tsx:24 e outras)

### P3.15 — App sem suporte a modo escuro (tema fixo claro)
- **Área:** ui-ux
- **Correção:** Avaliar tema escuro (variáveis de cor + prefers-color-scheme/darkMode do Tailwind) como melhoria pós-lançamento, ou assumir explicitamente o tema claro único como decisão. (index.css:6)

### P3.16 — Avatares remotos <img> sem loading=lazy nem decoding=async
- **Área:** mobile-perf
- **Correção:** Adicionar loading="lazy" + decoding="async" nos avatares de lista (Ranking top=50, Home). Rajada de até 50 downloads ao abrir o Ranking em rede móvel. (RankingScreen.tsx:114 / HomeScreen.tsx:41)

### P3.17 — Dismiss do toast de conquista é um div clicável, não um botão — WCAG 4.1.2/2.1.1
- **Área:** acessibilidade
- **Correção:** Anunciar via aria-live=polite (role=status) e, se o toque para fechar for relevante, usar <button> com aria-label 'Fechar', focável. (AchievementToast.tsx:20)

### P3.18 — README e paleta desatualizados sinalizam design/conteúdo não finalizados
- **Área:** release-store
- **Correção:** Sincronizar README ('194 perguntas' vs 3.268 reais) e fechar a paleta oficial (remover 'provisória' em tailwind.config.js:7). (README.md:143)

### P3.19 — Ícone maskable é RGB full-bleed (purpose 'any maskable') — risco de crop em launchers Android adaptativos
- **Área:** release-store
- **Correção:** Fornecer variante maskable com padding adequado (safe zone ~80% central) ou usar purpose 'any' com imagem maskable separada. Cosmético. (public/manifest.webmanifest:11)

## Top 10 antes da QA externa

- Corrigir o CLUSTER de perda de progresso (o BUG ATIVO) — as três causas-raiz JUNTAS: (a) em persist.ts, ler a camada mais nova (versão/timestamp) ou tornar o localStorage a fonte primária de leitura; (b) tornar profileStore.load() single-flight com re-check de `loaded` pós-await; (c) nunca adotar EMPTY em falha transitória de leitura (distinguir 'sem dado' de 'falha ao ler', tentar localStorage no catch do parse, backup rotativo). Sem as três, o sintoma persiste.
- Validar a correção acima com um teste de fumaça manual em device NATIVO real (iOS WKWebView e Android WebView): jogar várias partidas → matar o app pelo switcher → reabrir → confirmar que XP/stats/seen persistem, repetido em Normal e Stop. É o cenário que o QA externo vai exercer primeiro.
- Remover o gabarito do device: gerar artefato público (PublicQuestion sem answerIndex/explanation) para bundle e Storage, mover o conteúdo com gabarito para prefixo sem read público (só Admin SDK), fechar storage.rules e retornar explanation pela Function após submissão.
- Endurecer submitScore (e submitMatchTurn/answerDaily): sessão sorteada e persistida server-side, sessionId amarrado ao uid, validação de length/dedup/binding dos questionIds, sem retornar gabarito/contagem antes de encerrar. Sem isso o ranking é inútil e o QA competitivo não faz sentido.
- Habilitar App Check com provider NATIVO (App Attest/DeviceCheck no iOS, Play Integrity no Android) e enforceAppCheck nas callables sensíveis + request.app!=null nas rules — mas só ligar enforcement depois do provider nativo, senão bloqueia o app.
- Resolver o conteúdo (blocker B5): não shippar 3.268 perguntas de IA não verificadas. Reduzir ao subconjunto curado (~110) para o QA, ou implementar validação com fonte autoritativa (sourceUrl/verifiedAt) — QA de conteúdo em perguntas erradas é desperdício.
- Adicionar guarda de reentrância em next() (Normal) e desabilitar o botão durante o await, e try/catch em submitTurn (desafio online) só setando 'enviado' após sucesso — evita partida/score em dobro e jogada silenciosamente descartada.
- Adicionar ErrorBoundary/errorElement na raiz com fallback PT-BR + eliminar o flash de progresso zerado no cold start (gate em profileLoaded com skeleton ou hidratação síncrona do localStorage) — os dois mais expostos em QA com dados/dispositivos variados.
- Completar deleteAccount (username órfão, friendRequests enviados, matches) e alinhar a camada de conformidade: política de privacidade em URL pública revisada juridicamente, declarações de dados coerentes entre Play/Apple/PRIVACY.md (remover login Google inexistente/decidir FCM v1.1), e resolver o conflito de classificação etária <13 + recursos sociais. São requisitos de submissão e LGPD.
- Passada mínima de acessibilidade que atinge o core: remover o bloqueio de zoom (viewport), dar feedback não-cromático de acerto/erro com aria-live nos 5 modos, subir contraste do gray-400/300, e rotular os inputs de login com <label>+autoComplete. Mais: corrigir a esteira Android (gerar ícone/splash e versionCode incremental no codemagic.yaml), senão o 2º build é rejeitado pelo Play.
