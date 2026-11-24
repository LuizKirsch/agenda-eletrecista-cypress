/// <reference types="cypress" />
// Módulo: Atividade (P5.1 - Gerenciar tipos de atividade). Cenários CT-09 a CT-12.

function abrirNovoTipo() {
  cy.visit('/tipos-atividade');
  cy.contains('button', 'Novo tipo').click();
  cy.get('dialog[open]').should('contain', 'Novo tipo de atividade');
}

describe('Tipos de atividade', () => {
  beforeEach(() => {
    cy.loginComoSecretaria();
  });

  it('CT-09 [positivo] cria um tipo ativo, sem uso, com duração e valor formatados', () => {
    const nome = `Instalação de chuveiro ${Date.now()}`;
    abrirNovoTipo();
    cy.get('dialog[open] input[name="nome"]').type(nome);
    cy.get('dialog[open] input[name="duracao"]').type('90');
    cy.get('dialog[open] input[name="valor"]').type('150.5');
    cy.get('dialog[open]').contains('button', 'Salvar').click();

    cy.get('dialog[open]').should('not.exist');
    cy.contains('tbody tr', nome).within(() => {
      cy.contains('1 h 30 min');
      cy.contains(/150,50/);
      cy.contains('nenhum');
      cy.contains('.badge', 'Ativo');
    });
    // o que a tela mostra tem que bater com o que foi persistido
    cy.chamarApi('GET', '/api/tipos-atividade').then(({ body }) => {
      const criado = body.find((t) => t.nome === nome);
      expect(criado).to.include({ duracao_padrao_min: 90, valor_padrao: 150.5, ativo: true });
    });
  });

  it('CT-10 [negativo] recusa tipo com nome já existente', () => {
    cy.criarTipo().then((existente) => {
      abrirNovoTipo();
      cy.get('dialog[open] input[name="nome"]').type(existente.nome);
      cy.get('dialog[open] input[name="duracao"]').type('60');
      cy.get('dialog[open]').contains('button', 'Salvar').click();

      cy.get('dialog[open] [role="alert"]').should('have.text', 'Já existe um tipo de atividade com este nome.');
    });
  });

  it('CT-11 [negativo] duração fora de 5 a 720 min é barrada no formulário, sem chamar a API', () => {
    cy.intercept('POST', '/api/tipos-atividade', cy.spy().as('chamadaApi'));
    abrirNovoTipo();
    cy.get('dialog[open] input[name="nome"]').type('Tipo com duração inválida');
    cy.get('dialog[open] input[name="duracao"]').type('3');
    cy.get('dialog[open]').contains('button', 'Salvar').click();

    cy.get('dialog[open] input[name="duracao"]').then(($i) => {
      expect($i[0].validity.rangeUnderflow, 'valor abaixo do mínimo').to.be.true;
    });
    cy.get('dialog[open]').should('be.visible');
    cy.get('@chamadaApi').should('not.have.been.called');
  });

  it('CT-12 [positivo] desativa e reativa um tipo (inativo deixa de ser oferecido, mas é preservado)', () => {
    cy.criarTipo(); // garante que haverá outro ativo (regra: ao menos um tipo ativo)
    cy.criarTipo().then((tipo) => {
      cy.visit('/tipos-atividade');
      cy.contains('tbody tr', tipo.nome).within(() => {
        cy.contains('button', 'Desativar').click();
        cy.contains('.badge', 'Inativo');
        cy.contains('button', 'Reativar');
      });
      cy.chamarApi('GET', '/api/tipos-atividade').its('body').then((lista) => {
        expect(lista.find((t) => t.id === tipo.id).ativo).to.eq(false);
      });

      cy.contains('tbody tr', tipo.nome).contains('button', 'Reativar').click();
      cy.contains('tbody tr', tipo.nome).contains('.badge', 'Ativo');
    });
  });
});
