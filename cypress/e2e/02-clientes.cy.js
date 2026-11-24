/// <reference types="cypress" />
// Módulo: Cliente e Endereço (P3.1 cadastrar, P3.2 buscar). Cenários CT-05 a CT-08.
import telefonesInvalidos from '../fixtures/telefones-invalidos.json';
import { marcaSemDigitos, telefoneUnico } from '../support/commands';

const mascara = (d) => `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;

function abrirNovoCliente() {
  cy.visit('/clientes');
  cy.contains('button', 'Novo cliente').click();
  cy.get('dialog[open]').should('contain', 'Novo cliente');
}

describe('Clientes', () => {
  beforeEach(() => {
    cy.loginComoSecretaria();
  });

  it('CT-05 [positivo] cadastra um cliente e abre a ficha com o telefone formatado', () => {
    const nome = `Cliente Cadastro ${Date.now()}`;
    const digitos = telefoneUnico();

    abrirNovoCliente();
    cy.get('dialog[open] input[name="nome"]').type(nome);
    cy.get('dialog[open] input[name="telefone"]').type(digitos);
    cy.get('dialog[open]').contains('button', 'Salvar cliente').click();

    cy.location('pathname').should('match', /^\/clientes\/\d+$/);
    cy.get('h1').should('have.text', nome);
    cy.get('.perfil-cab .meta').should('contain', mascara(digitos)).and('contain', '0 endereços');
  });

  // Três ramos distintos da mesma validação de telefone (tamanho e DDD, RF 3.1): orientado a dados.
  telefonesInvalidos.forEach(({ caso, digitos }) => {
    it(`CT-06 [negativo] recusa telefone inválido: ${caso}`, () => {
      abrirNovoCliente();
      cy.get('dialog[open] input[name="nome"]').type('Cliente Telefone Inválido');
      cy.get('dialog[open] input[name="telefone"]').type(digitos);
      cy.get('dialog[open]').contains('button', 'Salvar cliente').click();

      cy.get('dialog[open] [role="alert"]').should('contain', 'Telefone inválido');
      cy.location('pathname').should('eq', '/clientes'); // não navegou para uma ficha
    });
  });

  it('CT-07 [negativo] recusa telefone já cadastrado em outro cliente', () => {
    cy.criarCliente().then((existente) => {
      abrirNovoCliente();
      cy.get('dialog[open] input[name="nome"]').type('Outro Cliente Mesmo Telefone');
      cy.get('dialog[open] input[name="telefone"]').type(existente.telefone);
      cy.get('dialog[open]').contains('button', 'Salvar cliente').click();

      cy.get('dialog[open] [role="alert"]').should('have.text', 'Já existe um cliente com este telefone.');
      cy.location('pathname').should('eq', '/clientes');
    });
  });

  it('CT-08 [positivo] busca filtra a lista por nome e informa quando nada é encontrado', () => {
    const marca = marcaSemDigitos();
    cy.criarCliente({ nome: `${marca} Alfa` });
    cy.criarCliente({ nome: `${marca} Beta` });
    cy.criarCliente({ nome: 'Cliente Sem Relacao' });

    cy.visit('/clientes');
    cy.get('input[aria-label="Buscar cliente"]').type(`${marca} Alfa`);
    cy.get('ul.lista li').should('have.length', 1).and('contain', `${marca} Alfa`);

    cy.get('input[aria-label="Buscar cliente"]').clear().type(marca);
    cy.get('ul.lista li').should('have.length', 2);

    cy.get('input[aria-label="Buscar cliente"]').clear().type(`${marca}-nao-existe`);
    cy.get('.vazio').should('have.text', 'Nenhum cliente encontrado.');
  });

  // DEFEITO CONHECIDO (BUG-01): hoje este teste FALHA, e é de propósito. Em services/cliente.service.js a busca usa
  // `soDigitos(busca) || busca` no filtro de telefone; um termo como "Apto 77" vira telefone LIKE '%77%' e devolve
  // clientes que não têm "Apto 77" no nome nem no telefone. A RN 39 manda buscar por PARTE do nome ou do telefone.
  it('CT-20 [negativo] [BUG-01] termo com números não pode trazer clientes que não correspondem ao nome', () => {
    const marca = marcaSemDigitos();
    cy.criarCliente({ nome: `${marca} Apto 77` });
    // isca: nome sem relação com a busca, mas com "77" no telefone
    cy.criarCliente({ nome: `Isca ${marca}`, telefone: `5197777${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}` });

    cy.visit('/clientes');
    cy.get('input[aria-label="Buscar cliente"]').type(`${marca} Apto 77`);
    cy.get('ul.lista li').should('have.length', 1).and('contain', `${marca} Apto 77`);
    cy.get('ul.lista').should('not.contain', `Isca ${marca}`);
  });
});
