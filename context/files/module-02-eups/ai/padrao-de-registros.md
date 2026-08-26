# Padrão de registros de contexto — Módulo 02 EUPS

Use este padrão para cada nova conversa, análise, decisão ou handoff relevante. Cada arquivo é um registro independente e não deve substituir os anteriores.

## Nome do arquivo

```text
AAAA-MM-DD__HHMM__nome-do-autor__tema-curto.md
```

Regras:

- usar horário `America/Sao_Paulo` em formato 24 horas;
- usar apenas minúsculas, números e hífens em `nome-do-autor` e `tema-curto`;
- remover acentos do nome de arquivo;
- manter o tema curto e identificável, por exemplo `eups-integracao-espacial`, `validacao-do-geopackage` ou `decisao-de-hospedagem`;
- nunca usar `README.md` como registro de conversa;
- não editar um registro histórico para alterar uma decisão: criar outro arquivo que faça referência ao anterior e registre a mudança.

Exemplo:

```text
2026-08-26__1527__rhuan-bello__eups-integracao-espacial.md
```

## Cabeçalho obrigatório

Todo registro começa com este bloco:

```md
# Registro de conversa — <tema>

| Campo | Valor |
| --- | --- |
| Data e hora | AAAA-MM-DD HH:MM (America/Sao_Paulo) |
| Autor | Nome completo |
| Tema | Descrição curta |
| Branch de referência | `nome-da-branch` |
| Status | Em análise / Decidido / Implementado / Bloqueado |
```

## Estrutura recomendada

Use somente as seções que fizerem sentido, mantendo os fatos distinguíveis das propostas:

```md
## Contexto
## Evidências verificadas
## Decisões
## Pendências e riscos
## Próximos passos
## Referências e arquivos relacionados
```

## Regras de conteúdo

- Registrar decisões como decisão, incluindo motivo e impacto quando necessário.
- Marcar hipóteses, sugestões de IA e informações não verificadas como tais.
- Referenciar arquivos do repositório por caminho relativo e fontes externas por URL.
- Nunca registrar tokens, cookies, chaves, credenciais ou dados pessoais desnecessários.
- Para decisões substituídas, criar um novo registro e apontar explicitamente qual decisão anterior foi superada.
