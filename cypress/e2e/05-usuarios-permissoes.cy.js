/// <reference types="cypress" />
// Módulo: Usuários e Acesso (P2.2/P2.3 e controle de perfil). Cenários CT-18 e CT-19.

describe('Usuários e permissões', () => {
  it('CT-18 [positivo] secretária cadastra um eletricista e ele consegue entrar no sistema', () => {
    const id = Date.now().toString(36);
    const novo = { nome: `Eletricista UI ${id}`, login: `eletr.ui.${id}`, senha: 'Senha@123' };

    cy.loginComoSecretaria();
    cy.visit('/usuarios');
    cy.contains('button', 'Novo usuário').click();
    cy.get('dialog[open]').within(() => {
      cy.get('input[name="nome"]').type(novo.nome);
      cy.get('input[name="login"]').type(novo.login);
      cy.get('input[role="combobox"]').click();
      cy.contains('[role="option"]', 'Eletricista').click();
      cy.get('input[name="senha"]').type(novo.senha, { log: false });
      cy.contains('button', 'Salvar usuário').click();
    });

    cy.get('dialog[open]').should('not.exist');
    cy.contains('tbody tr', novo.login).should('contain', novo.nome).and('contain', 'Eletricista');

    // prova ponta a ponta: o usuário criado autentica de verdade
    cy.request({ method: 'POST', url: '/api/auth/login', body: { login: novo.login, senha: novo.senha }, log: false }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.include({ nome: novo.nome, perfil: 'eletricista' });
    });
  });

  it('CT-19 [negativo] perfil eletricista não gerencia usuários, nem pela tela nem pela API (403)', () => {
    cy.loginComoSecretaria();
    cy.criarUsuario().then((eletricista) => {
      cy.loginApi(eletricista.login, eletricista.senha);

      cy.visit('/usuarios');
      cy.get('h1').should('have.text', 'Usuários');
      cy.get('tbody tr').should('contain', eletricista.login);
      cy.contains('button', 'Novo usuário').should('not.exist');
      cy.get('[aria-label^="Editar"], [aria-label^="Excluir"]').should('not.exist');

      cy.chamarApi('POST', '/api/usuarios', { nome: 'Invasor', login: `invasor.${Date.now()}`, senha: 'x12345', perfil: 'secretaria' }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body.erro).to.eq('Acesso permitido somente à secretária.');
      });
    });
  });
});
