# Log de curadoria — perguntas-amostra (Sprint 0)

Gerado pelo pipeline `gen-sample-questions` (gerar -> validar adversarial).
**Atenção:** este é um conjunto-AMOSTRA gerado por IA para validar o loop do app. NÃO é conteúdo de produção — antes de publicar precisa de fonte autoritativa (ground truth) por pergunta e amostragem humana (ver blocker B5 em PRD-REVIEW.md).

| Categoria | Perguntas finais |
|---|---|
| Geografia | 27 |
| História | 28 |
| Ciência & Natureza | 28 |
| Brasil | 27 |

## Correções / remoções na validação

### Geografia (6)

- REMOVIDA: 'Qual estado brasileiro faz fronteira com o maior número de países da América do Sul?' (resposta marcada: Amazonas). Pergunta factualmente DUVIDOSA/ambígua: o Amazonas faz fronteira com Venezuela, Colômbia e Peru (3 países). Porém o estado do Acre também faz fronteira com 2 países (Peru e Bolívia) e Roraima com 2 (Venezuela e Guiana). O Amazonas realmente lidera com 3, mas a contagem exata é debatível conforme a fonte e gera confusão; removida por risco de imprecisão.
- EDITADA (correção de UNICIDADE/precisão): 'Qual é o rio que corta a cidade de Manaus...'. O enunciado original sugeria que o Amazonas corta Manaus, o que é impreciso: em Manaus o rio é o Negro (afluente que forma o Amazonas no Encontro das Águas). Mantida a resposta (Rio Amazonas, que dá nome à bacia) e a explicação foi ajustada para esclarecer o Encontro das Águas.
- EDITADA (precisão): 'Qual é o rio mais extenso do mundo, conforme medições tradicionais?'. Reformulado para 'tradicionalmente considerado o mais extenso' e explicação ampliada, pois o Amazonas é considerado o mais longo por algumas medições recentes — evita ambiguidade entre Nilo e Amazonas.
- EDITADA (clareza): 'Qual cordilheira separa a Europa da Ásia no território russo?' reformulada para 'forma o limite tradicional', pois o Cáucaso também é citado como limite Europa-Ásia em outra região; o enunciado agora especifica o limite tradicional dos Urais.
- EDITADA (precisão): explicação do Lago Superior ampliada para esclarecer que o Mar Cáspio (também listado) é maior porém salgado, reforçando a unicidade da resposta de água doce.
- EDITADA (precisão): Belém está próxima à foz do Amazonas, não exatamente 'na foz' — ajuste de redação na explicação.

### História (2)

- Pergunta sobre Tancredo Neves (Redemocratização): CORRIGIDA o enunciado. O original afirmava que ele foi 'eleito pelo voto direto', o que é factualmente errado — Tancredo Neves foi eleito indiretamente pelo Colégio Eleitoral em janeiro de 1985 (as eleições diretas para presidente só voltaram em 1989, com Collor). Reescrevi o enunciado para 'eleito presidente do Brasil em 1985... faleceu antes de tomar posse' e ajustei a explicação para deixar claro que a eleição foi indireta e que quem assumiu foi o vice, José Sarney. A resposta correta continua sendo Tancredo Neves (answerIndex 0), mas agora sem distrator parcialmente válido e sem erro factual no enunciado.
- Pergunta sobre Constantino (Roma): pequena correção no enunciado, de 'adotou o cristianismo' para 'legalizou o cristianismo'. Constantino legalizou o cristianismo com o Edito de Milão (313) e convocou Niceia (325), mas sua conversão/batismo pessoal é tema debatido (batizado apenas no leito de morte). A versão 'legalizou' é mais precisa e mantém a resposta inequívoca (Constantino). answerIndex inalterado (2). Verifiquei todas as demais 26 perguntas closed-book: answerIndex correto, opções únicas sem distratores ambíguos, 4 alternativas e explicações corretas. Nenhuma pergunta foi removida; nenhuma duplicata encontrada.

### Ciência & Natureza (1)

- Nenhuma pergunta removida. Todas as 28 foram verificadas closed-book: o answerIndex aponta para a resposta factualmente correta em todas, há 4 opções em cada uma, sem duplicatas ou fatos perecíveis. Ajustes de unicidade: (1) Pergunta dos anéis de Saturno — reforcei o enunciado para 'proeminentes e visíveis' e a explicação esclarece que todos os gigantes gasosos têm anéis, mas o de Saturno é o único visível/extenso, eliminando ambiguidade com Júpiter/Urano/Netuno. (2) Pergunta da hemoglobina — adicionei à explicação que a mioglobina armazena oxigênio nos músculos (e não nas hemácias), reforçando por que o distrator não é correto. Demais perguntas mantidas sem alteração.

### Brasil (4)

- Removida a pergunta 'Qual animal é o símbolo mais associado ao Carnaval do Rio...': estava malformada — pede um 'animal', mas a alternativa correta ('A bateria e os carros alegóricos') não é um animal, gerando ambiguidade/incoerência entre enunciado e resposta.
- Corrigida a explicação da pergunta da final da Copa de 1970: o texto original dizia 'Maracanã do México (Estádio Azteca)', erro factual (o Maracanã fica no Rio). Ajustado para 'Estádio Azteca, no México'.
- Ajustado distrator da moqueca: trocado 'Bobó de camarão da Paraíba' por 'Bobó de camarão' (o bobó não é prato típico da Paraíba; a referência regional no distrator era incorreta e desnecessária).
- Pequenos ajustes de redação para precisão: 'considerado'->'considerada' (Carmen Miranda); 'filme em Hollywood'->'filmes em Hollywood'; 'escravo'->'menino' na lenda do Negrinho do Pastoreio; tucano descrito como ave 'de bico grande' em vez de citar propagandas (perecível). Nenhuma resposta correta foi alterada.

