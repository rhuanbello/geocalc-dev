# Registro de conversa — EUPS: integração espacial independente

| Campo | Valor |
| --- | --- |
| Data e hora | 2026-08-26 15:27 (America/Sao_Paulo) |
| Autor | Rhuan Bello |
| Tema | EUPS: integração espacial independente |
| Branch de referência | `feat/eups-base` |
| Status | Decisões registradas; aguardando arquivos-fonte locais |

Este registro consolida o que foi discutido sobre a EUPS, a base manual do módulo e a futura integração espacial de R e K. Materiais de IA, rascunhos e hipóteses não substituem as decisões registradas aqui.

## 1. Escopo atual do módulo

A EUPS estima a perda média anual de solo por erosão hídrica:

`PS = R × K × LS × CP`

O escopo encerra em **PS**. Não fazem parte deste módulo: QCPS, transporte fluvial, sedimentação ou uma classificação automática de território.

A base metodológica inicial foi preparada a partir da planilha e dos áudios fornecidos pelo Bida. A versão manual usa:

- `P = Σr`, com doze precipitações mensais;
- `I30 = 67,355 × (r² / P)^0,85`;
- `R = ΣI30`;
- `LS = 0,00984 × L^0,63 × S^1,18`;
- `PS = R × K × LS × CP`.

`PNE` foi removida: ela não consta na planilha nem nos áudios do Bida e não deve voltar ao modelo, à interface ou à exportação sem base metodológica explícita.

## 2. Estado do produto antes da integração espacial

O módulo EUPS atual é deliberadamente manual e didático:

- não tem mapa, coordenadas, geocodificação ou preenchimento automático;
- recebe chuva, K, L, S e CP manualmente;
- explica os fatores, as unidades, as referências de K e CP da planilha do Bida e as fórmulas;
- termina em tabela de cálculo, PS, classificação, síntese e Excel;
- mantém como referência bibliográfica Wischmeier e Smith (1965), *USDA Agriculture Handbook No. 282*.

As referências de K e CP vindas da planilha servem como apoio didático. Elas não são uma classificação territorial automática.

## 3. O que foi verificado sobre os dados da Embrapa

As verificações abaixo foram feitas nos serviços públicos GeoInfo/GeoServer da Embrapa em 2026-08-26. Elas são evidência técnica, não uma decisão de usar a API em produção.

| Fator | Dataset e camada a usar | Tipo | Campo/resultado de interesse | Observação |
| --- | --- | --- | --- | --- |
| **K** | dataset **6340**, `geonode:bra_erodibilidade_2024_sirgas2000` | vetorial | `k_solos`, `erod_um`, `fator_k_um`, `nom_unidad`, `legenda` | Fonte vetorial oficial; escala 1:500.000. |
| **R** | dataset **1775**, `geonode:erosividade_brasil_2023_defl` | raster | `GRAY_INDEX` | Mapa de erosividade anual; resolução aproximada de 1 km. |

### Correção importante: 6340 versus 6708

O dataset **6708** (`geonode:bra_erod_dashboard`) apareceu nas primeiras análises porque é usado no dashboard público. Contudo, seus próprios metadados dizem que ele é dedicado ao dashboard e remetem ao **dataset 6340** como a camada vetorial oficial. Portanto:

- usar **6340** como fonte de K;
- não acoplar cálculo, pipeline ou contratos de dados ao 6708;
- tratar 6708 apenas como evidência histórica da investigação inicial, não como fonte definitiva.

### Serviços públicos já comprovados

- K pode ser consultado por ponto via WFS com filtro espacial; o retorno pode ser limitado aos atributos necessários e não precisa transportar a geometria completa.
- R pode ser consultado por ponto via WMS `GetFeatureInfo`, retornando `GRAY_INDEX`.
- A visualização WMS da camada oficial de K retorna PNG válido com a simbologia da Embrapa.
- Os serviços testados retornam `Access-Control-Allow-Origin` duplicado. Isso impede uso confiável por `fetch()` diretamente no navegador.

Essas descobertas justificavam um proxy/Worker apenas para uma arquitetura que consumisse a Embrapa em tempo real. Essa não é mais a arquitetura escolhida.

## 4. Decisões da integração espacial

### Objetivo

O produto precisa ser independente da Embrapa durante a navegação do mapa. Não se deve solicitar ao GeoServer da Embrapa uma imagem nova a cada pan ou zoom.

### Arquitetura escolhida

1. A Embrapa permanece como origem metodológica e dos arquivos oficiais.
2. A aplicação prepara e hospeda seus **próprios artefatos de mapa** derivados desses arquivos.
3. O OpenStreetMap continua como mapa-base.
4. R e K aparecem como overlays próprios em **um único mapa**, com:
   - liga/desliga de cada fator;
   - opacidade por camada;
   - legenda e classes visuais da Embrapa;
   - uma única localização, marcador, pan e zoom compartilhados.
5. O clique lê R e K de nossos próprios dados, não da API Embrapa.
6. O cálculo EUPS usa R e K espaciais como fonte principal. L, S e CP continuam manuais.
7. R e K permitem sobrescrita manual explícita, preservando valor original, valor editado, localização, versão de dados e origem.

Mesmo com dados próprios, um mapa web buscará blocos do nosso CDN durante pan e zoom. A independência desejada é em relação à **Embrapa em runtime**, não a eliminar o carregamento normal de dados que qualquer mapa interativo exige.

### O que fica fora da primeira versão espacial

- Chamadas em produção para `geoinfo.dados.embrapa.br`;
- Worker/proxy da Embrapa;
- WMS da Embrapa como overlay visual;
- GeoPackage e GeoTIFF brutos no Git;
- hospedagem no próprio bundle Vite;
- conversão de sugestões de K/CP da planilha em classificação territorial automática.

## 5. Arquivos originais e processamento

O responsável pelo projeto disponibilizará, em pasta local **não versionada**, os seguintes arquivos:

- GeoPackage de K, estimado em 800 MB;
- GeoTIFF de R, estimado em 25 MB.

Antes de qualquer conversão, é obrigatório confirmar que o GeoPackage corresponde ao dataset 6340 e que o GeoTIFF corresponde ao dataset 1775. Para cada arquivo, registrar em manifesto versionado pequeno:

- origem/URL, dataset, data de obtenção e checksum;
- CRS, camada/banda, resolução e `NoData`;
- campos preservados e versão do processamento;
- licença, atribuição e limitações metodológicas conhecidas.

### Entregáveis derivados esperados

| Fator | Visualização | Consulta pontual | Atributos preservados |
| --- | --- | --- | --- |
| K | tiles vetoriais/PMTiles | índice vetorial estático, por exemplo FlatGeobuf | `k_solos`, classe, unidade, legenda e unidade de mapeamento |
| R | COG otimizado e/ou raster tiles/PMTiles | leitura do pixel no COG | valor bruto de R, `NoData`, resolução e versão |

Os formatos finais serão validados com os arquivos reais; não simplificar geometrias ou arredondar valores de forma que altere o fator usado no cálculo.

## 6. Infraestrutura e ferramentas

### Primeira entrega

Fazer uma POC local completa: conversão, mapa OSM, overlays R/K sincronizados, seleção de ponto e leitura dos fatores a partir dos artefatos próprios.

### Publicação posterior

Publicar somente os artefatos derivados em object storage/CDN com CORS e HTTP Range Requests. Cloudflare R2 é a opção recomendada para essa etapa; servir os arquivos não exige Worker.

### Ferramentas ainda ausentes no ambiente

O ambiente atual tem Node/npm, mas não possui `gdalinfo`, `ogrinfo`, `tippecanoe` ou `pmtiles`. Será necessário instalar ou executar essas ferramentas em contêiner controlado antes do processamento.

## 7. Validações obrigatórias

- Comparar K e R dos artefatos derivados com pontos de referência dos arquivos originais.
- Validar classes, cores e legendas contra a simbologia oficial da Embrapa.
- Confirmar pelo painel de rede que a aplicação não consulta a Embrapa em runtime.
- Confirmar que R e K usam sempre a mesma coordenada selecionada.
- Testar pan, zoom, visibilidade, opacidade, seleção, `NoData`, limites do Brasil, sobrescrita manual e cálculo de PS.
- Executar testes unitários, build e percurso manual no navegador.

## 8. Limitações que precisam aparecer no produto

- K do mapa nacional tem escala 1:500.000: é uma referência territorial, não substitui amostragem ou ensaio local.
- R é um raster nacional de aproximadamente 1 km; o valor não representa variabilidade abaixo dessa resolução.
- R espacial é anual e direto. Ele não deve preencher ou ser confundido com as doze chuvas e o `R = ΣI30` do fluxo manual da planilha.
- Todo resultado espacial deve mostrar fonte, versão, data de processamento e localização consultada.

## 9. Materiais relacionados

- Planilha do Bida: `../source/EUPS_Bida.xlsx`
- Transcrição dos áudios do Bida: `../generated/transcription/bida-audios-2026-08.md`
- Revisão interna inicial: `../revisao-interna/01.txt`
- Prova espacial histórica: `../generated/eups-spatial-sources-proof.json`
- Código do módulo manual: `src/shared/eups.ts`, `src/shared/eups-references.ts` e `src/front/modules/eups/EupsPage.tsx`
- GeoInfo/Embrapa: <https://geoinfo.dados.embrapa.br/developer/>
- Dataset K oficial: <https://geoinfo.dados.embrapa.br/catalogue/#/dataset/6340>
- Dataset R: <https://geoinfo.dados.embrapa.br/catalogue/#/dataset/1775>

## 10. Próximo passo concreto

Quando os dois arquivos forem disponibilizados localmente, informar seus caminhos. O primeiro trabalho será inspecioná-los, validar proveniência e gerar o manifesto; nenhuma conversão deve ocorrer antes dessa checagem.
