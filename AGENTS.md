@/home/rhuanbello/.codex/RTK.md

# Colaboração Codex e governança de issues

Estas regras se aplicam a todo o GeoCalc: módulos existentes, novas features, correções e módulos futuros. Elas evitam que o contexto fique preso a uma conversa, pessoa, branch ou worktree.

## Fonte canônica de contexto

Issues e seus comentários são a fonte operacional de contexto, decisão e andamento. Arquivos em `context/` são materiais-fonte e evidências; não são diário de conversa nem substituem uma decisão registrada no GitHub.

Toda demanda deve estar na hierarquia:

```text
Module issue
  └── Feature/Epic issue
        └── Task/bug/decision issue
```

Antes de agir, encontre a issue da tarefa e leia a cadeia de pais, incluindo comentários:

```bash
rtk gh issue view <issue> --repo rhuanbello/geocalc-dev --comments
```

Em caso de conflito, prevalecem nesta ordem:

1. decisão mais recente registrada na issue-pai relevante;
2. escopo, dependências e aceite da issue atual;
3. fontes e evidências linkadas pelas issues;
4. código e testes existentes;
5. hipóteses, memória de conversa ou sugestão de IA.

Não altere uma decisão relevante silenciosamente. Registre evidência, impacto e alternativa na feature/epic ou module issue correspondente antes de ampliar escopo.

## Labels e hierarquia

Cada issue deve ter exatamente um label `module:*` e um `type:*` — exceto bugs, que usam o label padrão `bug` como tipo. Use labels adicionais somente quando ajudam busca, priorização ou bloqueio.

| Dimensão | Labels |
| --- | --- |
| Módulo | `module:water-balance`, `module:eups`, `module:shared` |
| Tipo | `type:module`, `type:feature`, `type:task`, `type:decision`, `bug` |
| Área | `area:calculation`, `area:frontend`, `area:data`, `area:geospatial`, `area:infrastructure`, `area:documentation` |
| Prioridade | `priority:high`, `priority:medium`, `priority:low` |
| Exceção | `state:blocked`, `needs:decision` |

- Module issues representam a visão e o estado de um módulo.
- Feature/Epic issues representam uma capacidade ou iniciativa delimitada.
- Tasks representam trabalho implementável, revisável e atribuído a uma branch/PR.
- Decision issues registram escolhas que afetam mais de uma feature ou módulo.
- O GitHub Project é uma visão de fluxo; a hierarquia de issues continua sendo a fonte de contexto.

## Início de trabalho

1. Pesquise issues abertas com o módulo/área para evitar duplicidade.
2. Leia a issue da tarefa, os pais e os comentários.
3. Confirme dependências, responsável e bloqueios antes de editar.
4. Comente o início na issue da tarefa, incluindo branch, escopo e risco conhecido.
5. Confirme o branch e o estado do worktree ativo antes de editar:

```bash
rtk git branch --show-current
rtk git status --short
```

6. Trabalhe exclusivamente no worktree ativo e no branch definido pelo usuário ou pela issue. **Não crie, troque, remova nem use `git worktree` sem autorização explícita do usuário.**

7. Se a tarefa exigir outro branch, registre a necessidade na issue e peça orientação antes de criar ou mudar de branch. Não presuma isolamento por worktree como solução para trabalho paralelo.

Em caso de alterações locais de outra pessoa, preserve-as e informe o conflito de escopo; não tente contorná-lo criando um worktree paralelo.

## Comunicação nas issues

Use a issue da tarefa para andamento e a feature/module issue para mudanças de decisão, dependência ou escopo.

```bash
rtk gh issue comment <issue> --repo rhuanbello/geocalc-dev --body $'### Update\n- Done: ...\n- Evidence: ...\n- Next: ...\n- Blocker: none'
```

Para uma decisão proposta, inclua contexto/evidência, mudança, impacto, alternativas e a confirmação necessária. Para bloqueios, aplique `state:blocked`, explique a causa e remova o label assim que forem resolvidos.

## Criar issues

Crie uma issue nova somente depois de pesquisar as existentes e identificar o pai correto.

- Título: `<Module/feature>: <tema curto>`.
- Use o template adequado em `.github/ISSUE_TEMPLATE/`.
- Aplique um `module:*`, o tipo correto e área/prioridade quando conhecidos.
- Vincule a issue ao pai e registre qualquer dependência com relações de bloqueio.
- Não crie issues para perguntas pequenas; use comentários na issue existente.

## Entrega e Git

- PRs apontam para a branch de integração definida pela feature; o merge para `main` é controlado pelo responsável da integração.
- Referencie a issue no PR com `Refs #<issue>`; use `Closes #<issue>` somente quando o escopo estiver efetivamente concluído.
- Registre na issue os testes, a verificação manual, limitações e link do PR.
- Não use `git reset --hard`, `git push --force` ou operações destrutivas para sincronizar trabalho paralelo.
- `origin` é o repositório de desenvolvimento. O remoto `prod` é produção: não faça push, merge ou deploy nele sem autorização explícita.

## Dados e evidências

Não versionar dados brutos grandes, credenciais, tokens, cookies ou chaves. Versione scripts reproduzíveis, manifestos, configurações, testes e documentação técnica necessária. Sempre registre na issue a origem, versão, validação e limitações de dados externos antes de integrá-los ao produto.
