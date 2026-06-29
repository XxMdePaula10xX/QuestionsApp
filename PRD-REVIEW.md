# Revisão do PRD — App de Quiz (Sabido / Quiz BR) v1.0

**Data da revisão:** 29/06/2026
**Método:** revisão multi-perspectiva (5 lentes: arquitetura/custos Firebase, produto/game-design, segurança/anti-cheat/LGPD, pipeline de IA/qualidade de conteúdo, escopo/roadmap), consolidada e submetida a um passe crítico adversarial.

---

## Veredito: **precisa de revisão focada antes do Sprint 0**

O PRD tem uma **fundação técnica sólida** e um **diferencial de produto real**. Não precisa ser reescrito nem mudar de arquitetura. Mas há um punhado de **blockers de corretude e de conformidade** que, se não forem decididos antes de escrever código, corrompem o núcleo do app (rankings trapaceáveis) ou impedem a publicação nas lojas (LGPD/menores). Eles precisam ser fechados antes do Sprint 0 porque **mudam o modelo de dados, as security rules e o roadmap** — exatamente o que o Sprint 0 vai cimentar.

Resumo: resolva os **5 blockers + as 3 decisões que faltam na Seção 13**, e o PRD fica pronto para build.

---

## O que já está muito bom (não mexer)

1. **Perguntas em JSON estático fora do Firestore** (Seções 3, 4) — decisão de custo correta e madura. Elimina o maior dreno de leitura, viabiliza modo solo offline e desacopla conteúdo do backend. Validado por 4 das 5 lentes.
2. **Diferencial PT-BR nativo + categoria "Brasil"** (Seções 1, 4.1, 4.2.7) — moat defensável frente a traduções degradadas de bancos em inglês. Decisão de **não** traduzir OpenTDB está certa.
3. **Anti-cheat server-side como princípio desde o MVP** (Seções 3, 9, 10) — o esqueleto está correto; precisa ser **endurecido**, não inventado.
4. **Rankings agregados** com `weekId` ordenável, em vez de recalcular varrendo partidas (Seção 6) — padrão escalável.
5. **Escopo de conteúdo priorizado** — 30k como longo prazo, lançar com 5k, pipeline incremental, com erro factual tratado explicitamente como risco principal (Seções 4.1, 12).

---

## 🔴 Blockers — resolver ANTES do Sprint 0

### B1. O gabarito (`answerIndex`) embarcado no device torna os 4 rankings trapaceáveis
**Seções 3, 4.4, 9.** O JSON baixado no device inclui `answerIndex`. Qualquer cliente modificado, script ou inspeção do bundle Capacitor conhece **todas** as respostas antes de responder. A Function valida a *correção*, mas validar correção **não impede trapaça**: um bot que envia sempre a resposta certa com timing humano plausível é indistinguível de um ótimo jogador. Como o ranking é o único sistema de status do app, ele nasce corrompido. (Agravante: o PRD não diz **de onde** a Function lê o gabarito para validar.)

> **Recomendação:** nos modos com peso competitivo (Stop, Challenge, Desafio), servir ao device apenas `id + question + options`, **sem** `answerIndex`/`explanation`. A Function recebe os índices escolhidos + timestamps de servidor e devolve certo/errado + explicação **só após o envio**. O gabarito vive em fonte server-side (Storage com read negado a clientes, ou coleção Firestore restrita), na versão registrada na partida. Trade-off aceito e documentado: modos competitivos perdem o offline puro; o Normal solo (sem peso em ranking) pode manter gabarito local e funcionar offline. Habilitar **Firebase App Check** como segunda linha.

### B2. O modelo de write do `match` deixa o oponente ler as respostas do outro e forjar o resultado
**Seções 7, 10.** A Seção 10 dá read/write do documento inteiro aos 2 players, e `results[userId]` guarda `answers[]`, `correct` e `timeMs`. Logo o player B, ao abrir o doc para jogar, **lê as respostas de A** (acerta tudo) e o `timeMs` de A (crava tempo marginalmente menor). Pior: com write no doc inteiro, qualquer player pode sobrescrever `winnerId`, `status`, `questionIds` e o `results` do oponente — furando o anti-cheat server-side. Destrói o "coração do social" (5.4).

> **Recomendação:** o cliente **nunca** escreve em `results`/`winnerId`/`status`. Submissão de turno via Cloud Function callable (ou subcoleção `matches/{id}/submissions/{uid}` create-only, read restrito ao próprio uid). Resultado de cada jogador fica **privado até `FINISHED`** (revelação cega — B não recebe nada de A enquanto não submeter). Só a Function calcula o vencedor e escreve os campos agregados. Nas rules, players têm read apenas dos campos públicos (`status`, `players`, `createdAt`) e **sem write** nos sensíveis.

### B3. Idempotência da pontuação e máquina de estados do match indefinidas
**Seções 9, 5.4, 7, 10.** Dois problemas acoplados: **(1)** a Function que credita pontos não tem idempotência — retries em rede móvel, reexecução de Functions ou double-submit creditam duas vezes e inflam o ranking (justamente o ativo anti-cheat). **(2)** os estados `WAITING|A_DONE|B_DONE|FINISHED` não dizem quem transiciona nem garantem atomicidade; duas submissões quase simultâneas podem ambas ler `WAITING` e nenhuma fechar a partida, e **não existe estado `EXPIRED`** para o W.O. da Seção 12.

> **Recomendação:** gerar `sessionId` server-side no início da partida; a Function credita dentro de **uma transação** com `FieldValue.increment` + flag `scored:true`, rejeitando re-submissões do mesmo `sessionId`. Transição para `FINISHED` sempre pela Function, dentro de transação e idempotente (se já `FINISHED`, no-op). Adicionar estado `EXPIRED` com Function agendada para o W.O. Tornar `players`/`questionIds`/`createdAt` imutáveis pós-create; `winnerId` gravável uma única vez; definir semântica de empate (`winnerId: null` = empate vs. não-finalizado).

### B4. LGPD, dados de menores e exclusão de conta ausentes — **bloqueia a publicação nas lojas**
**Seções 8.1, 7, 10, 12, 13.** O PRD não menciona idade mínima, gate de menores, consentimento parental (LGPD art. 14 para <12), política de privacidade, base legal, retenção, nem **exclusão de conta/dados** (art. 18). Um quiz casual PT-BR atrai menores. Google Play (Data Safety/Families) e Apple (App Privacy) **exigem** essas declarações e o fluxo de exclusão de conta — sem isso o app é rejeitado e o relógio do teste fechado (12 testers/14 dias) reinicia. Agravante de minimização: o **e-mail mora em `users/{uid}` com read público** (Seções 7+10), expondo PII de todos (phishing/scraping).

> **Recomendação:** definir idade mínima + gate no onboarding (8.1); publicar Política de Privacidade + Termos (base legal, finalidade, retenção, canal do titular, **exclusão de conta e dados**); preencher Data Safety (Play) e App Privacy (Apple). Mover e-mail/PII para `users/{uid}/private/{uid}` (read só do próprio uid + Function) — idealmente nem duplicar do Firebase Auth.

### B5. Sem *ground truth*: a validação "dupla" por IA **pode** confirmar a própria alucinação
**Seções 4.5, 12.** O pipeline gera→dedup→valida→amostra **sem nenhuma fonte de verdade externa**. O gerador escreve a pergunta *e* o gabarito; se o validador for da mesma família de modelo, os erros tendem a ser **correlacionados** (o validador confirma a alucinação do gerador). "Factualmente correto" fica indefinido. Isso ataca diretamente o risco que o próprio PRD declara como principal e a meta de reporte <1% (Seção 2). É pré-requisito do Sprint 1, que já gera 1k perguntas reais.

> *Nota de calibração:* o PRD (4.5) só diz "segundo passe da IA", não que é o mesmo modelo. O risco de erros correlacionados é real e deve ser **mitigado**, mas é um risco a tratar, não um defeito já consumado.

> **Recomendação:** definir a(s) **fonte(s) autoritativa(s) por categoria** (Geografia/Brasil → Wikidata/IBGE; Esporte → base de resultados datada; Entretenimento → base de cinema/música). Estender o schema (4.4) com `sourceUrl`/`sourceId` + `verifiedAt` e **rejeitar na curadoria qualquer pergunta sem proveniência**. Tornar o validador **adversarial e diverso** (fornecedor diferente do gerador), respondendo *closed-book* e checando *open-book* contra a fonte, escalando divergências a humano. Calibrar o filtro contra um *gold set* rotulado por humanos.

---

## 🟠 Alta prioridade

- **Escopo de MVP grande demais para um dev solo** (Seções 5, 6, 11). 4 modos + 4 rankings + social assíncrono + pipeline de IA + 5k perguntas em 7 categorias + 2 lojas é um produto 1.0, não um MVP. O risco real é o cronograma escorregar e o autor queimar antes de lançar. *(Risco de planejamento, não defeito de corretude — mas alavanca enorme.)*
  **Corte sugerido:** Auth + Normal + **um** modo competitivo solo (Stop *ou* Challenge) + ranking Global + FTUE/streak + ~1,5–2k perguntas em 3–4 categorias + **Android primeiro**. Mover para v1.1/v1.2: desafio assíncrono, rankings semanal/amigos, o 2º modo competitivo, as 7 categorias e iOS. A métrica que importa (D7) é mensurável sem o social.
- **Custo de Cloud Functions não dimensionado** (Seções 3, 9). Cada partida solo chama a Function (validação + ranking), escalando invocações 1:1 com partidas. O PRD evita o custo de *read* do Firestore mas o troca por custo de Functions sem orçá-lo. Dimensionar DAU × partidas/dia × custo, definir teto de billing, considerar `min instances` p/ cold start, avaliar batelar crédito no Stop.
- **Write contention / hot doc** (Seções 6, 7, 9). `scores` + `stats` no mesmo `users/{uid}` → toda partida toca o mesmo doc (limite ~1 write/s). Usar transação única + `FieldValue.increment`; garantir que ranking é **coleção `entries` paginada** (nunca array num doc único); listar índices compostos.
- **Push vs. social — contradição de escopo** (Seções 5.4, 11). Push é "(futuro)" na 5.4 mas entrega do Sprint 4, e o social inteiro lança no Sprint 3 (um sprint **antes** do push). Jogo assíncrono sem push não fecha o loop de retorno → desafios expiram em W.O. e o social parece morto. Resolver deliberadamente: se o social sair do MVP, push sai junto; se ficar, push de turno vai para o **mesmo sprint** do social.
- **Fluxo de "adicionar amigo" nunca especificado** (Seções 5.4, 8.4, 7). Todo o social depende de "amigos" mas o PRD não diz **como** se adiciona alguém (busca? código? deep link? contatos?). Sem isso, ranking de amigos e desafio-a-amigo nascem vazios. Especificar busca por username + **link de convite** (deep link Capacitor = ótimo vetor viral). Definir se amizade é mútua (pedido+aceite) ou *follow* — hoje ambíguo (6.4 "segue/adicionou" vs. 5.4 "amigo").
- **Faltam motores de retenção (streak/daily) e FTUE** (Seções 2, 8.1, 5). D7≥25% é agressivo p/ trivia (benchmark casual ~10–18%) e **não há nenhum motor de hábito**: sem streak, missão/pergunta do dia, nem primeira-partida guiada. Adicionar streak diário + pergunta do dia + FTUE no Sprint 1; modelar `lastPlayedDate`/`currentStreak`. Adicionar métrica de **ativação** (1ª partida concluída) à Seção 2, ou recalibrar D7.
- **`timeMs` vem do cliente — spoofing direto** (Seções 7, 9, 5.2). Bônus de tempo do Stop e desempate do desafio dependem de um valor autodeclarado. Medir tempo **server-side** (`serverTimestamp` ao abrir e ao receber); clamping de tempos implausíveis (<~250ms); tratar `timeMs` do cliente como telemetria não-pontuável.
- **Pré-requisitos de publicação iOS/Android fora do Sprint 0** (Seção 11). "Codemagic validado" ignora conta Apple Developer (US$99 + lead time de dias), certificados/provisioning, APNs key, code signing/Mac, e conta Play (US$25) + keystore. Validar um **build assinado em device real** antes de escrever feature. Reforça lançar Android primeiro.
- **Reporte de perguntas sem rate-limit nem dedupe** (Seções 7, 8.7, 10). `create` por qualquer logado, sem limite → flooding e sabotagem (reportar perguntas corretas ataca a meta <1%). ID determinístico `reports/{questionId}_{uid}` (create-only), rate limit por uid, enum fechado de `reason`, e só promover à curadoria acima de um threshold de usuários distintos.
- **Esforço/custo do conteúdo (5k/30k) não dimensionado e empilhado no Sprint 4** (Seções 4.1, 4.5, 11). A curadoria humana, não a geração, é o gargalo. Tratar conteúdo como **esteira contínua desde o Sprint 1** (+1k/sprint), definir "bem curada" operacionalmente, e dedicar o último sprint só a publicação + teste fechado (iniciar o teste fechado da Play o quanto antes).

---

## 🟡 Média prioridade / melhorias

- **Cache & bundle não definidos** (3, 4.2, 11): "bundle no app" ≠ "cacheado no device" (decisões opostas). Persistir no **Capacitor Filesystem** (não localStorage), delta updates pela `version` por categoria do manifest, compressão (gzip/brotli), tamanho-alvo. *(Estimativa a validar: ~15–45 MB para 30k perguntas — premissa, não dado.)*
- **Distratores ambíguos** (4.4, 4.5): "plausível mas errado" tem tensão — quanto mais plausível, maior o risco de ser *também* defensável (capital vs. maior cidade). Adicionar checagem de **unicidade** ao validador e categoria de reporte "segunda resposta defensável".
- **Perguntas perecíveis** (4.4, 4.5, 7): presidente atual, recordes, novelas, lançamentos envelhecem e caem na taxa de reporte. Schema: `verifiedAt`, `volatility` (estável/perecível), `validUntil`; preferir formulações ancoradas no tempo; job de re-verificação só das perecíveis.
- **`weekId` — timezone e modelo de reset** (6, 7): fixar `America/Sao_Paulo`, centralizar o cálculo numa lib compartilhada, esclarecer se o reset é implícito (derivado da data na escrita) e definir TTL dos docs `weekly_*`.
- **Progressão rasa / tela de resultado** (5.1, 5.3, 8.3): XP/nível não destravam nada tangível. Adicionar conquistas/badges, considerar coleção (estilo coroas) e ligas semanais; desenhar a tela de resultado como **motor de re-entrada** (retry em 1 toque + comparação com recorde).
- **Riscos ausentes da Seção 12**: bus factor (dev solo), **ausência total de testes** (ao menos unitários na pontuação/Functions + smoke e2e), rejeição em review das lojas (quiz + conteúdo gerado por IA são escrutinados), conteúdo IA como gate de publicação.
- **Monetização ausente** (1, 2, 7, 8): o Perguntados (referência) vive de ads+IAP+power-ups; a Seção 2 cita "compra de vidas" como não-objetivo sem nunca definir a economia. Mesmo adiando a loja, **declarar uma seção "Monetização"** e reservar placement/schema, pois SDKs de ads/IAP afetam o build Capacitor e re-arquitetar economia pós-launch é caro.
- **Balanceamento categoria × dificuldade** (4.2, 4.3, 5.3): definir matriz-alvo de distribuição; "difícil" rotulado por IA é ruidoso — **calibrar dificuldade pela taxa de acerto real** em produção.
- **Schema do perfil** (7, 8.6): a tela promete precisão por categoria mas o schema não guarda nada por categoria → adicionar `statsByCategory`. Remover `accuracy` do storage (derivável). Tornar `scores`/`level`/`xp`/`stats` graváveis **só pela Function** (hoje "write só o próprio" deixa o cliente forjar o próprio score).
- **Direitos autorais & PII em Entretenimento/Brasil** (4.2): proibir reprodução verbatim de letras/roteiros; restringir perguntas sobre pessoas a fatos públicos verificáveis; cotas/tags regionais para combater o viés Sudeste dos LLMs.
- **Acesso ao JSON no Storage** (3, 9): servir só a autenticados (Storage rules + App Check), checksum por arquivo no manifest; App Check como pré-requisito do Sprint 2; rate limit/cooldown em todas as Functions de escrita; fila server-side no matchmaking aleatório.
- **Dependências entre sprints** (11, 9): o Normal nasce no Sprint 1 mas a validação server-side só entra no Sprint 2 → definir o **contrato de pontuação server-side já no Sprint 1** (ou marcar o Normal como spike client-side descartável). Anexar estimativas e critérios de aceite por sprint.
- **Analytics ausente** (2, 3): adicionar Firebase Analytics + event spec mínimo (`app_open`, `ftue_complete`, `match_start/finish`, `level_up`, `challenge_*`, `friend_added`, `report_submitted`) e definir como D7/partidas-por-sessão são calculados.
- **Operacional** (7, 12): `schemaVersion` nos docs; TTL/arquivamento de `matches` finalizados + Function do W.O.; moderação/filtro de `displayName` ofensivo (aparece público no ranking); `users/{uid}/tokens` para FCM.

---

## Contradições internas adicionais (achadas no passe crítico)

1. **Meta social órfã** (Seção 2): a KPI "≥30% iniciam ≥1 desafio" fica **impossível de medir** se o social for cortado do MVP. Cortar o social **exige** reescrever/remover essa meta da Seção 2 — não dá para aprovar o corte sem mexer na KPI.
2. **Matchmaking aleatório × menores** (5.4): parear menores com adultos desconhecidos (mesmo sem chat), com `displayName`/`photoURL` públicos no ranking, é exatamente o que as políticas Families (Play)/Kids (Apple) escrutinam — pode reprovar o app ou forçar classificação etária maior. Razão **independente** para restringir o desafio a amigos no MVP.
3. **"Web" enfraquece o anti-cheat** (Seção 1): manter web/PWA não é só escopo a mais — num browser, App Check usa reCAPTCHA (mais fraco), não há Filesystem nativo, e o bundle JSON é trivialmente inspecionável, **reforçando o blocker B1**. Decidir explicitamente se web é alvo do MVP.

---

## Recomendações para as decisões em aberto (Seção 13)

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| 1 | **Nome** | **Sabido** (principal); *Cuca* só após checagem de marca | "Quiz BR"/"Mestre" são genéricos e ruins p/ ASO. "Cuca" é ótimo mas é personagem do Sítio do Picapau Amarelo → risco de marca. "Sabido" é memorável e juridicamente mais seguro. Decidir cedo trava bundle ID/domínio/contas (lead time). |
| 2 | **Perguntas no Normal** | **6** (entre 5–6 do game-design e os 7 sugeridos), via remote config | Partida mais curta gira o loop de "3 partidas/sessão" mais rápido; manter total < ~90s. Ajustável remotamente evita republicar p/ tunar. |
| 3 | **Tempo do Stop** | **60s** default, exposto p/ A/B (45s vs 60s), com **retry imediato em 1 toque** | 60s bate com a referência; 30–45s aumentam tentativas/sessão. Partidas curtas multiplicam invocações da Function (ver custo). O retry imediato é o que torna o Stop viciante. |
| 4 | **Níveis do Challenge** | **~10**, mas com **1–2 checkpoints** + segunda-chance; **não** fixar antes de ter dados de dificuldade | Morte súbita pura no nível 9 gera churn de frustração. Milionário/Perguntados usam checkpoints (amarra com rewarded ad). A escada só funciona com sorteio server-side e dificuldade calibrada empiricamente. |

### Decisões que **faltam** na Seção 13 (promover a abertas)

| # | Decisão ausente | Recomendação |
|---|---|---|
| 5 | Onde vive o `answerIndex` em modos competitivos | **Não** embarcar no device; validar 100% via Function (pré-requisito do B1, muda o payload — decidir antes do Sprint 2). |
| 6 | Android-first vs. 2 lojas; push no MVP?; mínimo viável de perguntas; matchmaking aleatório vs. só amigos | **Android-first**; push fora do MVP se o social sair; **~2,5k em 3–4 categorias**; desafio **só entre amigos** no MVP. Determinam a viabilidade muito mais que o nome do app. |
| 7 | Fonte autoritativa (ground truth) por categoria; idade mínima/LGPD | Definir fontes por categoria **antes do Sprint 1**; idade mínima + menores + privacidade/exclusão **antes da publicação** (pré-requisitos dos blockers B5 e B4). |

---

## Checklist de lacunas a adicionar ao PRD (v1.1)

- [ ] Dimensionamento de custo de Cloud Functions + teto de billing
- [ ] Estratégia de cache (Capacitor Filesystem), invalidação, delta updates, tamanho-alvo do bundle
- [ ] Ground truth por categoria + validador diverso/independente; campos `sourceUrl`, `verifiedAt`, `volatility`, `validUntil`
- [ ] LGPD: idade mínima, gate de menores, consentimento parental, política de privacidade, retenção, **exclusão de conta/dados**
- [ ] PII (e-mail) em doc privado; write de dados de jogo só via Function
- [ ] App Check + rate limiting/cooldowns em todas as Functions de escrita; fila server-side no matchmaking
- [ ] Fonte server-side do gabarito p/ a Function; `questionsVersion` persistida no `match`
- [ ] Idempotência da pontuação (`sessionId`, flag `scored`, transação) + máquina de estados detalhada + estado `EXPIRED` + empate
- [ ] Estratégia contra hot doc nos rankings/perfil + índices compostos
- [ ] Streak/daily/pergunta do dia + FTUE + métrica de ativação
- [ ] Fluxo de adicionar amigo (busca + deep link) + definição mútua vs. follow; push de turno no sprint do social; `users/{uid}/tokens`
- [ ] Seção de Monetização (placement/schema reservados; power-ups por modo)
- [ ] Pré-requisitos de publicação (contas Apple/Play, certificados, APNs, keystore, code signing) no Sprint 0
- [ ] Estratégia de testes + estimativas + critérios de aceite por sprint; riscos de entrega na Seção 12
- [ ] Definição operacional da métrica <1% + gold set humano + dedupe/threshold de reportes
- [ ] Plano de analytics; matriz categoria × dificuldade; cotas regionais; política editorial de direitos autorais/PII
- [ ] Escopo de Web (declarar como não-objetivo ou tratar o impacto no anti-cheat); TTL de matches; checagem de unicidade da resposta; documento do pipeline de geração
- [ ] Reconciliar a meta social da Seção 2 com a decisão de manter/cortar o social do MVP
