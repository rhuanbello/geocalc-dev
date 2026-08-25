# GeoCalc - evolução desta rodada

Material de apoio para apresentar somente as mudanças desta PR, em resposta à `Revisão Bida 3`. O objetivo não é reapresentar a plataforma inteira: é validar o que mudou desde a última versão mostrada.

## Roteiro curto para a reunião

1. Mostrar o novo cabeçalho e os textos revisados.
2. Mostrar que INMET passou a ser o caminho principal e que há três normais climatológicas.
3. Explicar a nova regra do fator de correção em 5 graus.
4. Apresentar a planilha de comparação INMET x ERA5.
5. Explicar por que a tentativa com ERA5-Land não foi concluída.
6. Fechar com as validações metodológicas necessárias.

## Mudanças desta PR

### Novo layout do cabeçalho

- O cabeçalho deixou de ser apenas um título simples e passou a identificar o módulo de Balanço Hídrico dentro do GeoCalc.
- Foi incluída a logo do PPG Geoquímica/UFF, o nome do módulo e uma breve descrição do que ele calcula.
- A barra lateral ficou mais simples para não repetir a identidade institucional.
- O cabeçalho foi limitado a 150 px de altura no desktop, para dar presença visual sem afastar o conteúdo principal.

**Como apresentar:** “A intenção foi dar uma identidade institucional mais clara à ferramenta, sem colocar indicadores de cálculo antes de o usuário informar os dados.”

### Textos em “Conceitos básicos e metodologia”

- Os cards foram reorganizados para seguir a sequência do texto revisado:
  - O que é o Balanço Hídrico (BH)?
  - Entrada e saída de água no BH.
  - Por que estimar a Etp.
  - Índices na fórmula de Thornthwaite.
  - Correção de Etp para a latitude.
  - Superávit (SH) e Déficit (DH) Hídricos.
- Cada fórmula aparece no card que explica aquela etapa, em vez de ficar concentrada em um bloco separado.
- O card de índices de Thornthwaite ocupa a largura completa para acomodar `i`, `I` e `a` de forma legível.
- Os cards de correção por latitude e de SH/DH ficam lado a lado, pois completam a interpretação final do BH.

**Como apresentar:** “Mantivemos a ideia visual de cards, mas agora a sequência acompanha a lógica da explicação: primeiro o que entra e sai, depois como se estima a Etp, depois como se corrige e interpreta o resultado.”

### Textos em “Fontes de dados da obtenção da precipitação e temperatura”

- A seção foi ajustada para explicar a origem dos dados de P e t, sem repetir as fórmulas de Thornthwaite.
- O INMET é apresentado como fonte principal por estação meteorológica.
- Open-Meteo/ERA5 é apresentado como alternativa para coordenadas livres ou ausência de estação INMET adequada.
- Para Open-Meteo, o texto explica em linguagem direta:
  - chuva mensal = soma das chuvas diárias do mês;
  - temperatura mensal = média das temperaturas médias diárias;
  - a normal do período é a média de todos os janeiros, todos os fevereiros e assim sucessivamente.

**Como apresentar:** “A revisão separa duas coisas: primeiro ensinamos o cálculo do BH; depois explicamos de onde vêm P e t. Assim, não parece que a fonte de dados muda a fórmula.”

### Duas novas normais climatológicas INMET

- Além de 1991-2020, foram adicionadas as normais 1981-2010 e 1961-1990.
- O usuário escolhe a normal antes de buscar ou clicar em uma estação no mapa.
- Só aparecem estações que têm os 12 meses completos de precipitação, temperatura e coordenadas válidas para aquela normal:
  - 1961-1990: 280 estações;
  - 1981-2010: 297 estações;
  - 1991-2020: 109 estações.
- Os arquivos brutos INMET continuam locais. O site usa apenas JSONs derivados, limpos e versionados.

**Como apresentar:** “Cada normal é tratada como um conjunto fechado. O mapa e a busca mudam junto com o período, para não oferecer uma estação sem dados completos naquela normal.”

### INMET como opção padrão

- O fluxo inicial agora prioriza INMET, não Open-Meteo.
- O usuário escolhe uma normal INMET e seleciona a estação pela busca ou pelo mapa.
- Ao selecionar a estação, P e t mensais entram diretamente na tabela de cálculo.
- Open-Meteo/ERA5 permanece disponível quando não houver estação INMET adequada ou quando a pessoa quiser trabalhar com qualquer coordenada.

**Como apresentar:** “A decisão foi dar prioridade ao dado observacional por estação. A estimativa ERA5 não desapareceu; ela continua como alternativa transparente para situações em que o INMET não cobre o ponto.”

### Coordenadas na normal 1961-1990

- O arquivo de estações de 1961-1990 informa coordenadas em graus e minutos, por exemplo `12°17' S`.
- O GeoCalc converte essas coordenadas para graus decimais para poder mostrar o ponto no mapa e aplicar as regras de latitude.
- As coordenadas da normal 1961-1990 não coincidem sempre com os metadados de estações nas normais posteriores. Entre 198 códigos presentes nos dois conjuntos, 16 têm diferença superior a 10 km; o maior caso encontrado é cerca de 131 km.
- Isso não significa automaticamente que uma coordenada está errada: os arquivos podem registrar posição histórica, metadado distinto ou menor precisão.
- Com a regra atual de fator de correção, nenhuma dessas 198 estações mudou de faixa de latitude de fator. O impacto imediato é principalmente sobre o ponto exibido no mapa e sobre uma eventual consulta ERA5 futura por coordenada.

**Ponto para validar:** definir se, quando a mesma estação aparecer em várias normais, devemos manter a coordenada informada no arquivo de cada período ou adotar uma referência única de coordenadas da estação.

### Fator de correção em intervalos de 5 graus

- A tabela original de fatores foi preservada nas linhas fornecidas: 10, 20, 30 graus e assim por diante.
- Foi incluída a latitude 0 grau com fator 1,00 para todos os meses.
- Foram criadas linhas intermediárias de 5 graus pela média simples entre as duas linhas vizinhas do mesmo mês.
  - Exemplo: o fator de janeiro em 15 graus é a média entre janeiro em 10 e janeiro em 20 graus.
- A latitude real é associada ao múltiplo de 5 mais próximo:
  - 22 graus -> 20 graus;
  - 23 graus -> 25 graus;
  - 28 graus -> 30 graus.
- Fora da tabela, o sistema usa o limite disponível: até 60 graus no Norte e 50 graus no Sul.
- A mesma regra é usada na tela, no Excel exportado e na validação INMET x ERA5.

**Como apresentar:** “Não inventamos novos valores de 10 em 10 graus. Mantivemos a tabela e criamos somente o ponto intermediário de 5 graus pela média dos fatores imediatamente acima e abaixo. A ideia é aproximar melhor a latitude real do local.”

**Pontos para validar:**

- a interpolação linear em 5 graus é aceitável para o uso pretendido?
- o fator de outubro para latitude Sul 40 graus deve permanecer 0,87, como consta na planilha original?

### Planilha de validação INMET x Open-Meteo/ERA5

Arquivo: `docs/gerados/validacao-inmet-openmeteo-era5-1991-2020.xlsx`

- A comparação foi concluída para a normal 1991-2020.
- Foram lidas 267 estações nos arquivos de metadados; 109 tinham P, t e coordenadas completas e entraram na comparação. As 158 restantes são listadas com o motivo de exclusão.
- Para cada estação válida, ERA5 foi consultado na latitude e longitude oficiais da própria estação INMET, nunca no centro da cidade.
- Foram usados dados diários de 01/01/1991 a 31/12/2020. As consultas foram divididas em janelas de cinco anos somente para reduzir o risco de limite da API; a normal final utiliza os 30 anos completos.
- Para ERA5:
  - a chuva de cada mês é a soma dos valores diários;
  - a temperatura de cada mês é a média das temperaturas médias diárias;
  - a normal é a média de cada mês ao longo dos 30 anos.
- INMET e ERA5 passam pela mesma rotina de Balanço Hídrico e pelo mesmo fator de latitude. Assim, a comparação mostra como as diferenças de P e t entre fontes se propagam para Etp corrigida e BH.

#### Resultados principais

- 109 comparações anuais concluídas e 1.308 linhas mensais (109 estações x 12 meses).
- Em média, ERA5 ficou 148,1 mm abaixo do INMET na precipitação anual.
- A mediana da diferença de precipitação foi -130,4 mm; portanto, não é efeito de um único caso extremo.
- Em média, ERA5 ficou 0,179 grau Celsius acima do INMET na temperatura média anual.
- Em média, ERA5 ficou 173,6 mm abaixo do INMET no BH anual.
- Maiores diferenças absolutas de precipitação anual:
  - Recife (Curado, PE): 1.298,3 mm;
  - Belém (PA): 1.291,8 mm;
  - Belterra (PA): 1.138,9 mm.
- Maior diferença negativa de BH anual: Belém, -1.363,0 mm.
- Maior diferença positiva de BH anual: Belterra, +1.039,3 mm.
- Alagoinhas (BA) teve 5 meses em que INMET e ERA5 discordam entre SH e DH.

#### Como abrir a planilha na reunião

- **Resumo:** mostrar primeiro. Traz quantidades, médias, medianas, extremos e resumo por UF.
- **Ranking de diferenças:** abrir em seguida. É o caminho rápido para Belém, Recife, Belterra e demais casos que merecem discussão.
- **Comparativo anual:** filtrar uma estação. Mostra P, t, Etp corrigida, BH, SH, DH, MAE, RMSE e número de meses que mudam de classe.
- **Comparativo mensal:** usar apenas quando for preciso entender em quais meses uma diferença anual foi formada.
- **Dados INMET** e **Dados ERA5:** mostram P, t, FC, i, Etp, Etp corrigida, BH, SH e DH já organizados por mês.
- **Estações excluídas:** explica por que uma estação não entrou. Não há preenchimento artificial de dado faltante.

#### Leitura recomendada

- A planilha não afirma que uma fonte é melhor em qualquer situação.
- INMET é a referência observacional por estação nesta comparação.
- ERA5 é uma reanálise global por coordenada; ele não é uma medição feita no pluviômetro ou termômetro da estação.
- Diferenças altas podem estar relacionadas a chuva local, relevo, litoral, posição da estação ou à representação espacial da reanálise.
- A conclusão operacional desta rodada é: INMET deve ser a primeira escolha quando houver estação completa; ERA5 é alternativa útil, mas deve ser apresentado com a sua limitação explícita.

### Tentativa com ERA5-Land

- Foi iniciada uma comparação com ERA5-Land para verificar se um modelo de maior detalhamento espacial se aproximaria mais das estações.
- Na rota histórica do Open-Meteo testada, ERA5-Land retornou temperatura, mas `precipitation_sum` e `rain_sum` vieram nulos.
- Sem precipitação, não é possível montar P mensal nem calcular BH. Por isso, a comparação ERA5-Land não foi concluída.
- Não é um problema da fórmula do GeoCalc: é uma limitação da variável disponibilizada nessa rota para esse modelo.

**Próximo passo possível:** avaliar outra fonte de ERA5-Land que disponibilize precipitação histórica completa, como o Copernicus Climate Data Store, antes de retomar a comparação.

## Perguntas para fechar a rodada

- A sequência e os textos revisados representam adequadamente o documento `Revisão Bida 3`?
- A regra de 5 em 5 graus está metodologicamente aprovada?
- Como devemos tratar as diferenças de coordenadas do arquivo 1961-1990?
- Quais diferenças INMET x ERA5 são aceitáveis para uso didático ou exploratório?
- Quais estações do ranking devem virar casos de referência para a próxima reunião?
