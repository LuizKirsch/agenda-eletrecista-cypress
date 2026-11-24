# agenda-eletrecista-cypress

Testes automatizados E2E do sistema **Agenda do Eletricista** ([código do sistema](https://github.com/LuizKirsch/agenda-eletrecista)), feitos com **Cypress + JavaScript** para a disciplina de Teste de Software. O planejamento completo (cenários, justificativas, investigação de falha e evidências) está em [`RELATORIO.md`](RELATORIO.md).

## O que é testado

20 cenários (23 execuções) em 5 arquivos: autenticação, clientes, tipos de atividade, ordens de serviço/agenda e permissões de usuários. São 10 testes positivos e 10 negativos. Os testes usam a interface real no navegador e conferem também o que ficou gravado, via API.

## Rodar no GitHub Actions (ambiente dev)

O workflow [`e2e-dev.yml`](.github/workflows/e2e-dev.yml) roda a suíte contra **https://agenda-dev.187-41-125-189.sslip.io** a cada push na `main`, em pull requests e sob demanda (aba **Actions > Testes E2E > Run workflow**).

**Antes da primeira execução**, cadastre dois segredos em *Settings > Secrets and variables > Actions*:

| Segredo | Valor |
| --- | --- |
| `DEV_SECRETARIA_LOGIN` | login de um usuário com perfil **secretária** do ambiente dev |
| `DEV_SECRETARIA_SENHA` | senha desse usuário |

Sem eles o workflow falha logo no início, com uma mensagem dizendo o que falta. Depois de cada execução, a aba da execução mostra o resumo dos testes e o artefato `evidencias-e2e` traz o relatório HTML, os vídeos, as capturas de falha e o log.

> Os testes **criam dados no ambiente dev** (clientes, usuários eletricistas, tipos de atividade e ordens de serviço de hoje). Eles não apagam o que criaram, então o dev vai acumulando esses registros a cada execução.

## Rodar no seu computador

Pré-requisito: Node.js 20 ou mais novo.

```bash
npm install
```

**Contra o ambiente dev** (PowerShell):

```powershell
$env:BASE_URL = "https://agenda-dev.187-41-125-189.sslip.io"
$env:SECRETARIA_LOGIN = "seu-login"
$env:SECRETARIA_SENHA = "sua-senha"
npx cypress run          # ou: npx cypress open, para acompanhar passo a passo
```

**Contra o sistema local, com banco descartável.** Precisa do código do sistema ao lado desta pasta (uma pasta `server`) ou do caminho dele em `APP_DIR`. Com o sistema já com `npm install` e `npm run build` feitos:

```bash
npm test                 # sobe o sistema na porta 3100 com SQLite novo, roda tudo e derruba o servidor
```

Para ver os testes rodando na interface do Cypress, em dois terminais: `npm run servidor` e `npm run cy:open`.

## Resultado esperado

**22 testes passam e 1 falha.** A falha é o **CT-20**, de propósito: ele documenta um defeito real da busca de clientes do sistema (BUG-01, detalhes no relatório, seção 7). Quando o defeito for corrigido em `services/cliente.service.js` e a correção chegar ao ambiente dev, a suíte inteira fica verde.

## Variáveis

| Variável | Para quê |
| --- | --- |
| `BASE_URL` | URL do sistema (padrão `http://localhost:3100`) |
| `SECRETARIA_LOGIN`, `SECRETARIA_SENHA` | Usuário secretária (padrão do banco local: `maria` / `Teste@123`) |
| `APP_DIR` | Caminho do sistema, para o modo local, se não estiver em `../server` |
| `NAVEGADOR` | Caminho ou nome de outro navegador no `npm test`, em vez do Electron do Cypress |
