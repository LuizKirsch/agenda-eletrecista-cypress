// Comandos reutilizáveis da suíte. Cada teste monta seus próprios dados por API (rápido e
// independente da ordem de execução) e usa a interface só para o que de fato está sendo testado.

let sequencia = 0;
const unico = () => `${Date.now().toString(36)}${(sequencia += 1)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// Marcador só com letras (sem dígitos), útil para buscas por nome: dígitos no termo ativam também o
// filtro por telefone da API (ver CT-20) e poluiriam o resultado.
export const marcaSemDigitos = () => `Marca${Date.now().toString(36).replace(/\d/g, (d) => 'ghijklmnop'[d]).toUpperCase()}`;

// Telefone brasileiro válido e (praticamente) único: DDD 51 + 9 + 8 dígitos.
export function telefoneUnico() {
  const oito = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `519${oito}`;
}

// Mesma regra de "hoje" do front (fuso America/Sao_Paulo), para a OS aparecer na semana exibida.
export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// Sessão da secretária, reaproveitada entre testes (cy.session) para não repetir o login em cada um.
Cypress.Commands.add('loginComoSecretaria', () => {
  cy.loginApi(Cypress.expose('secretariaLogin'), Cypress.expose('secretariaSenha'));
});

Cypress.Commands.add('loginApi', (login, senha) => {
  cy.session(['sessao', login], () => {
    // log:false: a senha (do ambiente dev, no CI) não pode aparecer no log de comandos
    cy.request({ method: 'POST', url: '/api/auth/login', body: { login, senha }, log: false }).its('status').should('eq', 200);
  }, {
    validate() {
      cy.request({ url: '/api/auth/me', failOnStatusCode: false }).its('status').should('eq', 200);
    },
  });
});

// Chamada de API autenticada (usa o cookie da sessão ativa). Não falha em 4xx: o teste decide.
Cypress.Commands.add('chamarApi', (method, url, body) => cy.request({ method, url, body, failOnStatusCode: false }));

Cypress.Commands.add('criarCliente', (parcial = {}) => {
  const dados = { nome: `Cliente ${unico()}`, telefone: telefoneUnico(), ...parcial };
  return cy.chamarApi('POST', '/api/clientes', dados).then((res) => {
    expect(res.status, 'criar cliente (setup)').to.eq(201);
    return { ...dados, id: res.body.id };
  });
});

Cypress.Commands.add('criarEndereco', (clienteId) => {
  const dados = { identificacao: 'Casa', logradouro: 'Rua das Flores', numero: '100', bairro: 'Centro', cidade: 'Campo Bom' };
  return cy.chamarApi('POST', `/api/clientes/${clienteId}/enderecos`, dados).then((res) => {
    expect(res.status, 'criar endereço (setup)').to.eq(201);
    return { ...dados, id: res.body.id };
  });
});

Cypress.Commands.add('criarTipo', (parcial = {}) => {
  const dados = { nome: `Tipo ${unico()}`, duracao_padrao_min: 60, valor_padrao: '100', ...parcial };
  return cy.chamarApi('POST', '/api/tipos-atividade', dados).then((res) => {
    expect(res.status, 'criar tipo (setup)').to.eq(201);
    return { ...dados, id: res.body.id };
  });
});

Cypress.Commands.add('criarUsuario', (parcial = {}) => {
  const id = unico();
  const dados = { nome: `Eletricista ${id}`, login: `eletr.${id}`, senha: 'Senha@123', perfil: 'eletricista', ...parcial };
  return cy.chamarApi('POST', '/api/usuarios', dados).then((res) => {
    expect(res.status, 'criar usuário (setup)').to.eq(201);
    return { ...dados, id: res.body.id };
  });
});

// Monta cliente + endereço + tipo + eletricista e devolve tudo, pronto para criar OS.
Cypress.Commands.add('cenarioBase', () => {
  const base = {};
  return cy.criarCliente().then((c) => { base.cliente = c; })
    .then(() => cy.criarEndereco(base.cliente.id)).then((e) => { base.endereco = e; })
    .then(() => cy.criarTipo()).then((t) => { base.tipo = t; })
    .then(() => cy.criarUsuario()).then((u) => { base.eletricista = u; })
    .then(() => base);
});

// Cria uma OS com uma atividade. `quando` = { data, inicio, fim }.
Cypress.Commands.add('criarOs', (base, quando, eletricistaId = base.eletricista.id) => cy.chamarApi('POST', '/api/os', {
  cliente_id: base.cliente.id,
  endereco_id: base.endereco.id,
  eletricista_id: eletricistaId,
  atividades: [{ tipo_atividade_id: base.tipo.id, data: quando.data, hora_inicio: quando.inicio, hora_fim: quando.fim }],
}));
