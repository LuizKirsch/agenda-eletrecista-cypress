// `npm test`: sobe o servidor de teste, espera ficar saudável, roda o Cypress (headless), grava o log
// em evidencias/execucao.txt (evidência: testes executados, resultado, ferramenta e versão) e derruba o servidor.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const base = process.env.BASE_URL || 'http://localhost:3100';
const pasta = path.resolve(__dirname, '..');
const servidor = spawn('node', ['scripts/servidor-teste.js'], { cwd: pasta, stdio: 'inherit' });

function saudavel() {
  return new Promise((resolve) => {
    http.get(`${base}/health`, (res) => { res.resume(); resolve(res.statusCode === 200); }).on('error', () => resolve(false));
  });
}

(async () => {
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i += 1) {
    pronto = await saudavel();
    if (!pronto) await new Promise((r) => setTimeout(r, 500));
  }
  if (!pronto) { servidor.kill(); console.error('Servidor de teste não respondeu em 30 s.'); process.exit(1); }

  // NAVEGADOR=caminho/ou/nome permite usar Chrome em vez do Electron embutido (ex.: ambientes sem interface gráfica)
  const navegador = process.env.NAVEGADOR ? ['--browser', JSON.stringify(process.env.NAVEGADOR)] : [];
  const args = ['cypress', 'run', ...navegador, ...process.argv.slice(2)];

  fs.mkdirSync(path.join(pasta, 'evidencias'), { recursive: true });
  const log = fs.createWriteStream(path.join(pasta, 'evidencias', 'execucao.txt'));
  log.write(`Execução em ${new Date().toISOString()}\nComando: npx ${args.join(' ')}\n\n`);

  const filho = spawn('npx', args, { cwd: pasta, shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  const copiar = (alvo) => (dados) => { alvo.write(dados); log.write(dados); };
  filho.stdout.on('data', copiar(process.stdout));
  filho.stderr.on('data', copiar(process.stderr));
  filho.on('close', (codigo) => {
    log.end();
    servidor.kill();
    process.exit(codigo ?? 1);
  });
})();
