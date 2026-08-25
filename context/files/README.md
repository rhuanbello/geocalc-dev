# Materiais de trabalho

Snapshot versionado dos materiais necessários para retomar os dois módulos entregues ou em implementação. Os arquivos aqui não são carregados pelo frontend.

## Módulo 01: Balanço Hídrico

`module-01-water-balance/`

- `source/material-bidone/`: conceitos básicos, revisões e transcrições que orientaram a metodologia e a interface.
- `source/reuniao-03/`: revisão e anotações da reunião de 28/07/2026.
- `data/inmet/`: arquivos brutos das normais 1961-1990, 1981-2010 e 1991-2020, usados para gerar os JSONs derivados e auditorias.
- `generated/validation/`: auditoria INMET e comparações INMET x Open-Meteo/ERA5.
- `generated/reuniao/` e `generated/scripts/`: materiais produzidos para a reunião com o Bida.

## Módulo 02: EUPS

`module-02-eups/`

- `source/EUPS_Bida.xlsx`: planilha central de fórmulas, unidades, classificação e regressão do módulo.
- `source/*.ogg`: áudios recebidos junto do material do módulo; ainda não transcritos nesta implementação.
- `generated/eups-spatial-sources-proof.json`: prova técnica de 23/08/2026. TOPODATA retornou declividade para pontos testados; GeoInfo/Embrapa apresentou timeout.

## Escopo e higiene

- A EUPS usa a planilha apenas como referência interna e teste; ela não é apresentada como exemplo na UI.
- Caches de API, builds (`dist/`), arquivos temporários e materiais de módulos futuros não entram nesta pasta.
- Para o estado técnico e as próximas decisões da EUPS, leia o [handoff](../2026-08-25__01a03ad7-12bc-7430-ac47-4096177add86__feat-eups-spatial-mvp__eups-spatial-mvp-handoff.md).
