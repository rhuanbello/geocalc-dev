---
threadId: "01a03ad7-12bc-7430-ac47-4096177add86"
date: "2026-08-25"
branch: "feat/eups-spatial-mvp"
topic: "EUPS com fatores espaciais revisáveis"
---

# EUPS com fatores espaciais revisáveis

## Summary of what was discussed
- O GeoCalc já possui o módulo de Balanço Hídrico (BH), com normais INMET, Open-Meteo/ERA5 como alternativa, mapa, exportação Excel e conteúdo metodológico consolidado.
- O Módulo 02 deve ser a EUPS (Equação Universal de Perda de Solo), guiado pela planilha local `docs/semana 04/modulo-2/EUPS_Bida.xlsx`, mas não limitado à reprodução literal da planilha.
- A EUPS deve demonstrar valor de sistema: escolha de ponto no mapa, medição de vertente, fatores rastreáveis, possibilidade de revisão manual, síntese e Excel.
- A implementação atual adiciona o módulo EUPS, cálculo puro, mapa para ponto/linha, edição de fatores, estimativa de R por precipitação, resultados, síntese e exportação Excel. Não há dados de exemplo na interface.
- O fluxo precisava ficar explícito: escolher local define coordenada; `Medir L` exige ao menos dois cliques e preenche o comprimento da vertente; o resultado só aparece quando R, K, L, S e CP estão válidos.
- A tela inicialmente sugeria carregamento automático de todos os fatores sem entregá-lo. Esse é um problema de UX e de escopo: a consulta espacial de S foi comprovada, mas R e K ainda não têm uma fonte Embrapa estável integrada.

## Key decisions
- **Decision:** Criar a EUPS como módulo independente do BH, sem compartilhar o estado de localização.
  - **Rationale:** cada cálculo deve manter sua própria área de estudo e histórico de fatores.
  - **Impact:** `App.tsx` só decide o módulo; a tela EUPS está em `src/front/modules/eups/`.
  - **Alternatives considered:** compartilhar automaticamente o ponto escolhido no BH; ficou para evolução futura.
- **Decision:** Usar a formulação da planilha como contrato de cálculo.
  - **Rationale:** preservar a base didática do Bidone e garantir regressão mensurável.
  - **Impact:** `I30 = 67,355 × ((P_mensal² / P_anual)^0,85)`, `R = soma(I30)`, `LS = 0,00984 × L^0,63 × S^1,18`, `PNE = R × K × LS`, `PS = K × R × LS × CP`.
  - **Alternatives considered:** usar diretamente R obtido de uma camada espacial; é suportado como segundo método, mas não deve ser preenchido sem fonte rastreável.
- **Decision:** Exigir 12 meses completos para estimar R por precipitação no app.
  - **Rationale:** evitar uma estimativa anual incompleta no uso público.
  - **Impact:** o exemplo da planilha com 11 meses (sem maio) permanece somente como teste de regressão interno: P anual 1350, R 7946,147214..., LS 6,888024..., PS 1477,797914... com K 0,027 e CP 1.
  - **Alternatives considered:** aceitar a tabela incompleta como interface padrão; rejeitado.
- **Decision:** CP é manual e deve ficar entre 0 e 1.
  - **Rationale:** cobertura, manejo e conservação são escolhas contextuais; não devem ser deduzidos silenciosamente.
  - **Impact:** a UI fornece referências aproximadas e exige revisão.
  - **Alternatives considered:** automatizar CP via MapBiomas; adiado, pois classe de uso do solo não define CP sem tabela/metodologia validada.
- **Decision:** L é obtido por linha desenhada no mapa, mas continua editável.
  - **Rationale:** comprimento de vertente não é equivalente a altitude ou declividade do pixel.
  - **Impact:** `EupsMapPicker` possui os controles Local, Medir L, Limpar e Reenquadrar; a partir do segundo clique, a linha atualiza o campo L em metros.
  - **Alternatives considered:** tentar calcular L automaticamente por fluxo acumulado; adiado para análise espacial por área/raster.
- **Decision:** S é o primeiro fator espacial automático.
  - **Rationale:** a prova local ao TOPODATA/INPE retornou declividades numéricas nos pontos de Brasília, Niterói e Bauru.
  - **Impact:** ao definir um ponto, `fetchTopodataSlope` consulta o STAC TOPODATA, lê o COG de declividade `SN` e preenche S. O valor continua revisável.
  - **Alternatives considered:** deixar S exclusivamente manual; descartado porque a fonte já foi tecnicamente comprovada.
- **Decision:** não preencher R ou K com aproximações enquanto as camadas Embrapa não forem acessíveis e verificadas.
  - **Rationale:** o GeoInfo/Embrapa não respondeu às consultas pontuais WMS/WFS testadas neste ambiente; valores inventados comprometeriam o rigor acadêmico.
  - **Impact:** R pode ser calculado por precipitação; no método espacial, R e K permanecem para revisão manual até existir adaptador/local cache confiável.
  - **Alternatives considered:** converter automaticamente classes em K numérico; rejeitado sem a metodologia e a base oficial concreta.
- **Decision:** não publicar a API espacial nesta etapa.
  - **Rationale:** Cloud Run só faz sentido depois de as fontes R, K e S retornarem valores rastreáveis e estáveis.
  - **Impact:** o GitHub Pages continua front-only; o probe de fontes é local e gera apenas `docs/gerados/eups-spatial-sources-proof.json`, ignorado pelo Git.
  - **Alternatives considered:** criar Cloud Run antes da prova de fontes; adiado.

## Open questions
- [ ] Obter uma rota confiável ou um download oficial local/cacheável para o mapa de erosividade R da Embrapa. O mapa citado pela Embrapa é de escala nacional e a camada deve fornecer valor numérico, unidade e metadados por ponto.
- [ ] Obter e validar o dado oficial do fator K da Embrapa, incluindo valor/faixa, classe, escala e regra de revisão. A publicação de 2025 indica classes/faixas de K, mas isso não substitui consultar o dado espacial correto.
- [ ] Verificar no navegador local se o TOPODATA permite CORS e Range Requests para o COG. O adaptador foi compilado e a leitura foi comprovada via script Bun; caso o navegador bloqueie, criar um proxy apenas no ambiente de desenvolvimento e depois um endpoint de produção.
- [ ] Definir com o Bidone as referências acadêmicas finais para CP, a classificação de PS e o uso de R espacial versus R por precipitação.
- [ ] Decidir se o método de R por precipitação deve importar uma normal INMET, Open-Meteo/ERA5 ou ambos como já está na interface; a UI atual suporta ambos, mas ainda precisa de validação metodológica.
- [ ] Confirmar se a escala nacional das camadas Embrapa é apropriada ao nível de detalhe esperado para o MVP educacional.

## Follow-ups
- [ ] Executar e testar manualmente a EUPS no servidor local: escolha de ponto, carregamento de S, medição de L, preenchimento de K/R/CP e cálculo de PNE/PS.
- [ ] Atualizar a UI para separar de forma ainda mais clara: `carregado automaticamente`, `valor informado/revisado` e `fonte indisponível`.
- [ ] Baixar/cachear localmente os dados oficiais R/K, se a licença e o formato permitirem, e criar uma consulta pontual versionada ou um artefato derivado apropriado.
- [ ] Quando R/K estiverem disponíveis, construir um adaptador único de fatores espaciais com resposta contendo valor, unidade, fonte, escala, data e necessidade de revisão.
- [ ] Criar testes de integração com respostas simuladas para sucesso, dado ausente, timeout e sobrescrita manual de cada fator.
- [ ] Só depois da prova completa avaliar Cloud Run com cache de 30 dias, orçamento e alertas; não incluir chaves no frontend.
- [ ] Revisar o tamanho do bundle depois da integração de `geotiff`; ele está carregado dinamicamente e gera chunks separados, mas o bundle principal do app já excede o aviso do Vite.

## Immediate next steps
- Abrir `http://127.0.0.1:5176/geocalc/` caso o servidor ainda esteja ativo e validar a consulta de S após selecionar um ponto.
- Caso o TOPODATA falhe no navegador, registrar a mensagem exibida e implementar o proxy de desenvolvimento antes de qualquer publicação.
- Investigar os artefatos oficiais da Embrapa: o WMS/WFS `geoinfo.dados.embrapa.br/geoserver/ows` apresentou timeout de conexão neste ambiente em 2026-08-23.
- Não anunciar R/K como automáticos até a consulta estar funcionando de ponta a ponta.

## Quick references
- Relevant files:
  - `src/front/modules/eups/EupsPage.tsx` — interface e fluxo da EUPS.
  - `src/front/components/EupsMapPicker.tsx` — ponto de estudo e medição de L.
  - `src/front/lib/eups-spatial.ts` — consulta pontual TOPODATA e leitura de COG.
  - `src/shared/eups.ts` — fórmulas e validação pura.
  - `src/shared/geography.ts` — distância geodésica para L.
  - `src/front/lib/eups-excel-export.ts` — planilha de saída.
  - `scripts/probe-eups-spatial-sources.ts` — prova local de fontes; saída em `docs/gerados/` não versionada.
  - `docs/semana 04/modulo-2/EUPS_Bida.xlsx` — fonte local da planilha; `docs/` é ignorado pelo Git.
- Useful commands:
  - `bun run test`
  - `bun run build`
  - `bun run probe:eups-spatial`
  - `bun run dev -- --host 127.0.0.1 --port 5176`
- Internal links (if any):
  - Branch: `feat/eups-spatial-mvp`
  - Base branch at start: `main` (`7f4c49c feat(inmet): audit climate normals`)

## Notes
- O projeto usa Bun, React, Vite e TypeScript; o app é publicado como frontend estático no GitHub Pages.
- Foi adicionada a dependência de desenvolvimento `geotiff@3.0.5` para leitura pontual de Cloud Optimized GeoTIFFs do TOPODATA.
- Testes atuais após esta rodada: `bun run test` com 49 testes aprovados e `bun run build` aprovado. O Vite mantém aviso de chunk principal acima de 500 kB.
- Não houve commit desta rodada antes deste handoff. O próximo commit deve seguir Conventional Commits com escopo EUPS.
