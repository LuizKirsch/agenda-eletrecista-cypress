# Relatório de testes automatizados: Agenda do Eletricista

Disciplina de Teste de Software, segunda etapa. Este documento reúne o planejamento, a suíte automatizada, os resultados e a investigação de falha do sistema **Agenda do Eletricista** (projeto da disciplina de Tomada de Decisão). Data da execução: 24/11/2026.

**Resumo:** 25 cenários planejados, 20 automatizados (23 execuções), **22 passaram e 1 falhou**. A falha é esperada: o teste CT-20 expõe um defeito real do sistema (BUG-01, seção 7).

- **Sistema testado:** aplicação web de agenda e ordens de serviço (React + Express + Sequelize), sistema próprio, diferente dos usados em aula.
- **Ferramenta principal:** opção B, **Cypress + JavaScript** (a aplicação inteira já é JavaScript, então teste e sistema compartilham linguagem e ferramentas).
- **Relatório automático:** `cypress-mochawesome-reporter` (HTML com gráficos e capturas de tela embutidas), mais vídeo de cada spec e o log do terminal.
- **Ambiente:** dois modos. Localmente, o `npm test` sobe uma cópia do sistema em `localhost:3100` com banco SQLite novo a cada execução. No **GitHub Actions**, o workflow `.github/workflows/e2e-dev.yml` roda a mesma suíte contra o ambiente dev publicado (`agenda-dev.187-41-125-189.sslip.io`), com o usuário secretária guardado em segredos do repositório.

## 1. Exploração manual

Antes de automatizar, percorri o sistema como secretária e como eletricista. Os fluxos principais encontrados:

| Área | O que existe |
| --- | --- |
| Acesso | Login com sessão por cookie (JWT), logout, dois perfis (secretária e eletricista) |
| Clientes e endereços | Cadastro com telefone validado (DDD + 8 ou 9 dígitos, sem repetição), busca por nome ou telefone, endereços e observações, exclusão com regras |
| Tipos de atividade | Criar, editar, ativar e inativar, nome único, duração de 5 a 720 min, ao menos um tipo ativo |
| Ordens de serviço e agenda | Agenda semanal, criar OS com várias atividades, aviso de conflito de horário, concluir, cancelar, remarcar (arrastando), excluir |
| Orçamentos | Montar, versionar, aceitar (gera OS) ou recusar |
| Usuários | Cadastro, edição e exclusão restritos à secretária |

As regras de negócio (RN) citadas abaixo vêm do vault de documentação do projeto.

## 2. Cenários identificados (planejamento)

Prioridade: **A** = risco alto (quebra o uso diário ou a segurança), **M** = médio, **B** = baixo.

| ID | Funcionalidade | Objetivo | Resultado esperado | Prior. | Automatizar? | Justificativa |
| --- | --- | --- | --- | --- | --- | --- |
| CT-01 | Login | Entrar com credenciais válidas | Abre a agenda, mostra nome e perfil, cookie `token` httpOnly criado | A | **Sim** | Porta de entrada de todo o sistema; roda a cada mudança |
| CT-02 | Login | Recusar credenciais inválidas (senha errada, login inexistente) | Mensagem única "Login ou senha inválidos.", segue em `/login`, sem cookie | A | **Sim** | Segurança: a mesma mensagem nos dois casos evita descobrir quais logins existem. Duas entradas, mesma regra, daí o teste orientado a dados |
| CT-03 | Rota protegida | Acessar tela sem sessão | Redireciona para `/login`; a API responde 401 | A | **Sim** | Controle de acesso básico, barato de verificar |
| CT-04 | Logout | Sair encerra a sessão | Volta para `/login`; `/api/auth/me` responde 401 | M | **Sim** | Garante que sair realmente invalida o acesso, não só troca de tela |
| CT-05 | Cadastro de cliente | Cadastrar cliente válido | Abre a ficha com o nome e o telefone formatado `(51) 9xxxx-xxxx` | A | **Sim** | Fluxo mais usado, base para OS e orçamento |
| CT-06 | Cadastro de cliente | Recusar telefone inválido (7 dígitos; DDD iniciado em 0; 2º dígito do DDD 0) | Mensagem "Telefone inválido…", cadastro não acontece | A | **Sim** | Cada dado cai num ramo diferente da regex de RF 3.1 (tamanho e DDD); fixture com os casos |
| CT-07 | Cadastro de cliente | Recusar telefone repetido | "Já existe um cliente com este telefone." | M | **Sim** | Regra de unicidade (RF 3.1) que depende do banco, não do formulário |
| CT-08 | Busca de cliente | Filtrar por nome e informar quando nada é achado (RN 39) | Lista só com os correspondentes; "Nenhum cliente encontrado." | M | **Sim** | Usa busca com atraso (debounce), bom caso para esperas inteligentes |
| CT-09 | Tipo de atividade | Criar tipo válido | Linha na tabela com duração `1 h 30 min`, valor e situação Ativo, igual ao gravado na API | M | **Sim** | Cadastro-base usado em OS e orçamento |
| CT-10 | Tipo de atividade | Recusar nome repetido | "Já existe um tipo de atividade com este nome." | M | **Sim** | Regra de unicidade (RF 5) |
| CT-11 | Tipo de atividade | Duração menor que 5 min | O formulário barra (`rangeUnderflow`) e nenhuma chamada à API é feita | B | **Sim** | Validação no cliente, diferente das validações do servidor dos outros testes |
| CT-12 | Tipo de atividade | Desativar e reativar | Badge muda para Inativo e volta para Ativo; API confirma | M | **Sim** | Inativar é a forma de "apagar" sem perder histórico (RN 19/20) |
| CT-13 | Agenda e OS | Concluir atividade pela agenda | Bloco muda para concluída; banco registra `concluida` | A | **Sim** | Coração do sistema: ciclo de vida da OS (P6.6) |
| CT-14 | Agenda e OS | Sobreposição de horário do mesmo eletricista | OS salva (RN 11 só avisa), `aviso_conflito=true`, destaque na agenda e alerta no detalhe | A | **Sim** | Regra de negócio mais característica do sistema |
| CT-15 | Agenda e OS | Atividades coladas (fim = início) | Sem conflito | M | **Sim** | Análise de valor-limite do CT-14; pega erro de `<` contra `<=` |
| CT-16 | Cliente | Excluir cliente que tem OS | Bloqueia com "Este cliente tem OS vinculada e não pode ser excluído."; cliente permanece | A | **Sim** | Integridade dos dados (RN 42) |
| CT-17 | Ordem de serviço | Fim igual ao início | API responde 400 "O horário de fim precisa ser depois do início (1ª atividade)." | M | **Sim** | Validação de entrada do servidor, fora do alcance do formulário |
| CT-18 | Usuários | Secretária cadastra eletricista e ele consegue entrar | Usuário aparece na tabela e autentica de verdade | A | **Sim** | Teste ponta a ponta de dois módulos (usuários e acesso) |
| CT-19 | Usuários | Eletricista tenta gerenciar usuários | Tela sem "Novo usuário", editar e excluir; API responde 403 | A | **Sim** | Autorização por perfil: falha aqui é falha de segurança |
| CT-20 | Busca de cliente | Termo com números não pode trazer quem não corresponde | Só o cliente cujo nome contém o termo | M | **Sim** | Escrito depois de uma falha intermitente investigada (ver seção 7); hoje **falha** e documenta o defeito BUG-01 |
| CN-01 | Agenda | Arrastar atividade para remarcar (P1.1) | Atividade muda de dia e hora | A | **Não** (nesta entrega) | O bloco usa `setPointerCapture`, que o Cypress não simula; exigiria eventos de ponteiro artificiais, frágeis. Cobertura parcial: a remarcação é uma chamada de API (`PATCH /atividades-os/:id/horario`), candidata a teste de API |
| CN-02 | OS | Exportar OS em PDF | Nova aba com a OS pronta para imprimir | B | **Não** | Abre outra aba (`window.open`) e usa o diálogo de impressão do navegador, fora do alcance do Cypress; o ganho não paga o custo |
| CN-03 | Orçamento | Montar, aceitar e gerar a OS (P4.1, P4.2) | OS criada com os horários escolhidos | A | **Não** (nesta entrega) | Fluxo longo, vários modais e cálculo de horários; ficou para uma segunda fase da suíte. O risco está parcialmente coberto por CT-13 a CT-17 |
| CN-04 | Layout celular | Agenda em lista no celular | Troca da grade pela lista semanal | B | **Não** | Verificação visual de layout, melhor feita manualmente ou com teste de regressão visual |
| CN-05 | Sessão | Expiração do token JWT (7 dias) | Mensagem "Sua sessão expirou." | M | **Não** | Depende de passagem de tempo; o custo de simular supera o benefício |

## 3. Cenários escolhidos para a suíte

Dos 25 cenários planejados, **20 foram automatizados** (CT-01 a CT-20, que viram **23 execuções** porque CT-02 e CT-06 são orientados a dados) e 5 ficaram de fora com justificativa (CN-01 a CN-05).

| Tipo | Quantidade | Testes |
| --- | --- | --- |
| Positivos | 10 | CT-01, 04, 05, 08, 09, 12, 13, 14, 15, 18 |
| Negativos | 10 | CT-02, 03, 06, 07, 10, 11, 16, 17, 19, 20 |

O enunciado pede 6 testes (2 positivos e 2 negativos) no mínimo.

## 4. Organização da suíte

```
teste/
├── cypress.config.js           configuração: URL base, relatório, vídeo, credenciais de teste
├── cypress/
│   ├── e2e/                    (pasta padrão do Cypress: os testes)
│   │   ├── 01-autenticacao.cy.js      CT-01 a CT-04
│   │   ├── 02-clientes.cy.js          CT-05 a CT-08, CT-20
│   │   ├── 03-tipos-atividade.cy.js   CT-09 a CT-12
│   │   ├── 04-ordens-servico.cy.js    CT-13 a CT-17
│   │   └── 05-usuarios-permissoes.cy.js  CT-18, CT-19
│   ├── fixtures/               dados dos testes orientados a dados
│   └── support/commands.js     comandos reutilizáveis (login, criação de dados por API)
├── scripts/
│   ├── servidor-teste.js       sobe o sistema com banco descartável
│   └── rodar-tudo.js           sobe o servidor, roda o Cypress, grava o log, derruba o servidor
├── relatorios/index.html       relatório automático (gerado)
└── evidencias/execucao.txt     log da execução (gerado)
```

## 5. Como os conteúdos da disciplina aparecem na suíte

| Conteúdo da aula | Onde está |
| --- | --- |
| Seletores | Atributos estáveis e com sentido: `name`, `aria-label`, `role`, textos visíveis (`cy.contains`). Nenhum seletor por posição ou classe de estilo, exceto `.bloco` e `.lista`, que são classes de estrutura da própria agenda |
| Esperas e sincronização | Nenhum `cy.wait(ms)` fixo. As asserções do Cypress repetem até passar (CT-08 espera a busca com atraso; CT-13 espera a agenda recarregar). `cy.intercept` com espião no CT-11 prova que **não** houve requisição |
| Assertions | Todo teste tem asserções sobre tela **e** dado persistido (API/banco): CT-09, CT-13, CT-16, CT-18 |
| Testes positivos e negativos | Seção 3 |
| Reutilização de código | `support/commands.js`: `loginComoSecretaria`, `criarCliente`, `criarEndereco`, `criarTipo`, `criarUsuario`, `cenarioBase`, `criarOs`, `chamarApi` |
| Parametrização e testes orientados a dados | `fixtures/credenciais-invalidas.json` (CT-02) e `fixtures/telefones-invalidos.json` (CT-06) geram um teste por linha |
| Setup e teardown | `beforeEach` com `cy.session` (login uma vez, reaproveitado). Dados montados por API em cada teste, com nomes e telefones únicos, então a ordem não importa. O banco é apagado e recriado a cada `npm test` (setup), e o servidor é derrubado no fim (teardown) |
| Organização de suítes | Um arquivo por módulo, IDs no título (CT-xx) e marcação `[positivo]`/`[negativo]` |
| Investigação de falhas | Seção 6 |
| Relatórios e evidências | Seção 7 |

## 6. Resultados da execução

Ferramenta: **Cypress 16.3.0** (Node.js), relatório `cypress-mochawesome-reporter`. Servidor de teste com banco SQLite novo. Resultado por teste:

| Teste | Tipo | Resultado |
| --- | --- | --- |
| CT-01 login válido abre a agenda | positivo | passou |
| CT-02 credenciais inválidas: senha errada | negativo | passou |
| CT-02 credenciais inválidas: login inexistente | negativo | passou |
| CT-03 rota protegida sem sessão | negativo | passou |
| CT-04 sair encerra a sessão | positivo | passou |
| CT-05 cadastrar cliente | positivo | passou |
| CT-06 telefone inválido: poucos dígitos | negativo | passou |
| CT-06 telefone inválido: DDD começando com zero | negativo | passou |
| CT-06 telefone inválido: 2º dígito do DDD zero | negativo | passou |
| CT-07 telefone repetido | negativo | passou |
| CT-08 busca por nome | positivo | passou |
| CT-20 busca com números não traz clientes sem relação (BUG-01) | negativo | **falhou** |
| CT-09 criar tipo de atividade | positivo | passou |
| CT-10 nome de tipo repetido | negativo | passou |
| CT-11 duração fora do intervalo | negativo | passou |
| CT-12 desativar e reativar tipo | positivo | passou |
| CT-13 concluir atividade pela agenda | positivo | passou |
| CT-14 conflito de horário | positivo | passou |
| CT-15 atividades coladas, sem conflito | positivo | passou |
| CT-16 excluir cliente com OS | negativo | passou |
| CT-17 horário de fim inválido | negativo | passou |
| CT-18 cadastrar eletricista e entrar | positivo | passou |
| CT-19 eletricista sem acesso a usuários | negativo | passou |

**Totais:** 23 execuções, 22 passaram, 1 falhou, 0 puladas. Em quatro execuções seguidas o resultado foi o mesmo, o que mostra que os testes são estáveis e que a falha do CT-20 é reproduzível.

## 7. Investigação de falha: BUG-01 (busca de cliente)

**Como apareceu.** O CT-08 passava e falhava de forma intermitente (cerca de 1 em 3 execuções). Em vez de aumentar a espera ou repetir o teste, investiguei:

1. Registrei as requisições com `cy.intercept` e vi que a requisição de busca **voltava com a lista errada**: ora todos os clientes, ora o cliente certo mais um estranho.
2. O texto do campo estava correto, então o problema não era digitação nem sincronização do teste.
3. O nome de teste continha dígitos (`Busca…28nc`). Em `services/cliente.service.js`, a busca usa `soDigitos(busca) || busca` no filtro de telefone: os dígitos do termo viram `telefone LIKE '%28%'`, que casa com qualquer telefone com "28". Como todos os telefones de teste começam com `519`, um termo com "19" trazia a base inteira.

**Veredito.** Defeito do sistema, não do teste. A RN 39 manda buscar por parte do nome ou do telefone, e "Apto 77" não é parte do telefone de ninguém.

**Reprodução manual.** Cadastre "Maria Apto 77" e outro cliente com telefone `(51) 97777-0001`. Busque `Apto 77`: aparecem os dois.

**Tratamento.** O CT-08 passou a usar um marcador sem dígitos (`marcaSemDigitos`), o que o torna estável e fiel à regra. O comportamento errado ganhou um teste próprio, o **CT-20**, que falha hoje e documenta o defeito. Evidência da falha: `Too many elements found. Found '2', expected '1'` (captura de tela e vídeo no relatório).

**Correção sugerida** (não aplicada, pois o código do sistema não era o alvo desta atividade): usar o filtro de dígitos só quando o termo inteiro parecer telefone, por exemplo `/^[\d\s()+-]+$/.test(busca)`.

A captura de tela da falha fica no relatório HTML e no artefato `evidencias-e2e` da execução no Actions.

## 8. Evidências de execução

Cada `npm test` gera, dentro de `teste/`:

- `evidencias/execucao.txt`: log completo do terminal, com **ferramenta e versão** (Cypress), navegador, cada teste executado com ✓ (passou) ou número (falhou), resumo por arquivo e totais.
- `relatorios/index.html`: relatório HTML do Mochawesome com todos os testes, status, duração, gráfico de aprovados e reprovados, e captura de tela embutida do teste que falhou. Abra no navegador.
- `cypress/videos/*.mp4`: um vídeo por arquivo de teste.
- `cypress/screenshots/`: captura de cada falha.
- **No GitHub Actions**, os mesmos arquivos saem no artefato `evidencias-e2e`, e o resumo dos testes aparece na página da execução.

## 9. Conclusão

A suíte cobre os fluxos de maior risco do sistema: acesso e permissões, cadastro e validação de clientes, tipos de atividade e o ciclo de vida da OS com a regra de conflito de horário. Os testes são independentes entre si, montam seus próprios dados e conferem tanto a tela quanto o dado gravado.

O trabalho de automação já encontrou um defeito real (BUG-01) que o uso manual não mostrou. Ficaram para uma próxima fase o fluxo de orçamento até a geração da OS e a remarcação por arrastar e soltar, que pedem uma abordagem própria (seção 2, CN-01 e CN-03).
