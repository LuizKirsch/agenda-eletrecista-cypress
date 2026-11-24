// Sobe o sistema para os testes: banco SQLite novo e descartável + migrations + servidor Express
// servindo o build do React. Usa a porta 3100 para não colidir com `npm run dev` (3000).
// Pré-requisito: `npm run build` na raiz (gera client/dist).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Raiz do sistema: APP_DIR, ou a pasta irmã `server` (layout agenda-eletricista/server + agenda-eletricista/teste),
// ou a pasta acima (quando esta suíte está dentro do repositório, como e2e/).
const candidatos = [process.env.APP_DIR, path.resolve(__dirname, '..', '..', 'server'), path.resolve(__dirname, '..', '..')].filter(Boolean);
const raiz = candidatos.find((c) => fs.existsSync(path.join(c, 'server.js')));
if (!raiz) {
  console.error('Não achei o sistema (server.js). Defina APP_DIR com o caminho da pasta do projeto.');
  process.exit(1);
}
const tmp = path.resolve(__dirname, '..', '.tmp');
fs.mkdirSync(tmp, { recursive: true });
const banco = path.join(tmp, 'teste.sqlite');
fs.rmSync(banco, { force: true });

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: process.env.PORT || '3100',
  DB_DIALECT: 'sqlite',
  DB_STORAGE: banco,
  JWT_SECRET: 'segredo-somente-para-testes-e2e',
  SECRETARIA_NOME: 'Maria',
  SECRETARIA_LOGIN: process.env.SECRETARIA_LOGIN || 'maria',
  SECRETARIA_SENHA: process.env.SECRETARIA_SENHA || 'Teste@123',
};

if (!fs.existsSync(path.join(raiz, 'client', 'dist', 'index.html'))) {
  console.error('client/dist não encontrado. Rode `npm run build` na raiz do projeto antes dos testes.');
  process.exit(1);
}

const migrate = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: raiz, env, stdio: 'inherit', shell: true });
if (migrate.status !== 0) process.exit(migrate.status || 1);

const servidor = spawn('node', ['server.js'], { cwd: raiz, env, stdio: 'inherit' });
const encerrar = () => servidor.kill();
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
servidor.on('exit', (codigo) => process.exit(codigo ?? 0));
