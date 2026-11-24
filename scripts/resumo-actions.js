// Lê o log do Cypress (evidencias/execucao.txt) e escreve um resumo em Markdown no stdout.
// Usado pelo workflow para preencher o painel da execução ($GITHUB_STEP_SUMMARY).
const fs = require('fs');

const arquivo = process.argv[2] || 'evidencias/execucao.txt';
if (!fs.existsSync(arquivo)) { console.log('Sem log da execução.'); process.exit(0); }

const linhas = fs.readFileSync(arquivo, 'utf8').replace(/(\x1b\[|\^\[\[)[0-9;]*m/g, '').split('\n');
const specs = [];
let atual = null;
const falhas = [];

linhas.forEach((l, i) => {
  let m;
  if ((m = l.match(/Running:\s+(\S+\.cy\.js)/))) { atual = { nome: m[1], ok: 0, falhou: 0, pulou: 0 }; specs.push(atual); }
  else if (atual && /^\s+✓\s+CT-/.test(l)) atual.ok++;
  else if (atual && /^\s+\d+\)\s+CT-/.test(l)) atual.falhou++;
  else if (atual && /^\s+-\s+CT-/.test(l)) atual.pulou++;
  else if (atual && (m = l.match(/^\s+(\d+) pending/))) atual.pulou += Number(m[1]);
  // Bloco de erro: "  1) Suíte" / "       CT-xx ...:" / "     AssertionError: ..."
  if ((m = l.match(/^\s+(CT-\S.*):$/)) && /^\s+\d+\)\s/.test(linhas[i - 1] || '')) {
    const erro = (linhas.slice(i + 1, i + 4).find((x) => /Error/.test(x)) || '').trim();
    falhas.push({ teste: m[1], erro });
  }
});

const soma = (k) => specs.reduce((s, x) => s + x[k], 0);
const ok = soma('ok'), falhou = soma('falhou'), pulou = soma('pulou');
const esc = (s) => s.replace(/\|/g, '\\|');

const out = [];
out.push(`**${falhou ? '❌' : '✅'} ${ok} passaram · ${falhou} falharam · ${pulou} pulados** (${ok + falhou + pulou} testes)`, '');
out.push('| Arquivo | Passou | Falhou | Pulado |', '|---|---:|---:|---:|');
specs.forEach((s) => out.push(`| ${s.nome} | ${s.ok} | ${s.falhou} | ${s.pulou} |`));
if (falhas.length) {
  out.push('', '#### Falhas', '');
  falhas.forEach((f) => out.push(`- **${esc(f.teste)}**${f.erro ? `<br>\`${esc(f.erro.slice(0, 200))}\`` : ''}`));
}
console.log(out.join('\n'));
