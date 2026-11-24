/// <reference types="cypress" />
// Módulo: Usuários e Acesso (P2.1 - Autenticar). Cenários CT-01 a CT-04 do plano de testes.
import credenciaisInvalidas from '../fixtures/credenciais-invalidas.json';

describe('Autenticação', () => {
  beforeEach(() => {
    cy.clearCookies();
  });

  it('CT-01 [positivo] login válido abre a agenda e identifica o usuário logado', () => {
    cy.visit('/login');
    cy.get('input[name="login"]').type(Cypress.expose('secretariaLogin'));
    cy.get('input[name="senha"]').type(Cypress.expose('secretariaSenha'), { log: false });
    cy.contains('button', 'Entrar').click();

    cy.location('pathname').should('eq', '/agenda');
    // o nome exibido tem que ser o do usuário autenticado (a API informa quem é a sessão)
    cy.request('/api/auth/me').its('body').then(({ nome }) => {
      cy.get('aside .quem').should('contain', nome).and('contain', 'Secretária');
    });
    // a sessão é um cookie httpOnly com o JWT (nunca guardado em localStorage)
    cy.getCookie('token').should('exist').and('have.property', 'httpOnly', true);
  });

  // Mesma regra de segurança para duas entradas diferentes: o sistema não pode revelar QUAL dos
  // dois campos errou (evita enumeração de usuários). Por isso o teste é orientado a dados.
  credenciaisInvalidas.forEach(({ caso, login, senha }) => {
    it(`CT-02 [negativo] recusa credenciais inválidas sem revelar o motivo: ${caso}`, () => {
      cy.visit('/login');
      // "{secretaria}" = o login real da secretária do ambiente testado (assim "senha errada" é de fato senha errada)
      cy.get('input[name="login"]').type(login === '{secretaria}' ? Cypress.expose('secretariaLogin') : login);
      cy.get('input[name="senha"]').type(senha, { log: false });
      cy.contains('button', 'Entrar').click();

      cy.get('[role="alert"]').should('have.text', 'Login ou senha inválidos.');
      cy.location('pathname').should('eq', '/login');
      cy.getCookie('token').should('not.exist');
    });
  });

  it('CT-03 [negativo] rota protegida sem sessão redireciona para o login', () => {
    cy.visit('/clientes');
    cy.location('pathname').should('eq', '/login');
    cy.contains('button', 'Entrar').should('be.visible');
    cy.request({ url: '/api/clientes', failOnStatusCode: false }).its('status').should('eq', 401);
  });

  it('CT-04 [positivo] sair encerra a sessão e bloqueia o acesso à API', () => {
    cy.loginComoSecretaria();
    cy.visit('/agenda');
    cy.get('aside button[aria-label="Sair"]').click();

    cy.location('pathname').should('eq', '/login');
    cy.request({ url: '/api/auth/me', failOnStatusCode: false }).its('status').should('eq', 401);
  });
});
