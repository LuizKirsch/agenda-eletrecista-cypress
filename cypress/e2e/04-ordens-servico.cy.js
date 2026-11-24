/// <reference types="cypress" />
// Módulos: Agenda e Ordem de Serviço (P6.1, P6.5 conflito, P6.6 concluir, P3.3 excluir cliente).
// Cenários CT-13 a CT-17. As OS são criadas por API; a interface é usada para o que está sendo testado.
import { hojeSP } from '../support/commands';

// Abre o bloco da agenda pelo teclado (Enter): o bloco é role="button" e o clique do mouse usa
// pointer capture, que o Cypress não simula. Quando o teclado funciona, a acessibilidade também fica coberta.
const abrirBloco = (nome, indice = 0) => cy.get('.grade .bloco').filter(`:contains("${nome}")`).eq(indice).focus().type('{enter}');

describe('Ordens de serviço e agenda', () => {
  beforeEach(() => {
    cy.loginComoSecretaria();
  });

  it('CT-13 [positivo] concluir a atividade pelo detalhe da OS atualiza a agenda e o banco', () => {
    cy.cenarioBase().then((base) => {
      cy.criarOs(base, { data: hojeSP(), inicio: '10:00', fim: '11:00' }).then((res) => {
        expect(res.status).to.eq(201);
        const osId = res.body.id;

        cy.visit('/agenda');
        abrirBloco(base.cliente.nome);
        cy.get('dialog[open]').should('contain', `OS ${osId}`).and('contain', 'Agendada');
        cy.get('dialog[open] .acoes-atividade').contains('button', 'Concluir').click();

        cy.get('dialog[open]').should('not.exist'); // RF 1.27: alterou, fecha e recarrega a semana
        cy.get('.grade .bloco').filter(`:contains("${base.cliente.nome}")`).should('have.class', 'status-concluida');
        cy.chamarApi('GET', `/api/os/${osId}`).its('body.atividades.0.status').should('eq', 'concluida');
      });
    });
  });

  it('CT-14 [positivo] atividades sobrepostas do mesmo eletricista geram aviso de conflito (RN 11: avisa, não bloqueia)', () => {
    cy.cenarioBase().then((base) => {
      const dia = hojeSP();
      cy.criarOs(base, { data: dia, inicio: '13:00', fim: '14:00' }).its('body.aviso_conflito').should('eq', false);
      cy.criarOs(base, { data: dia, inicio: '13:30', fim: '14:30' }).then((res) => {
        expect(res.status, 'a OS é salva mesmo com conflito').to.eq(201);
        expect(res.body.aviso_conflito).to.eq(true);
      });

      cy.visit('/agenda');
      cy.get('.grade .bloco.conflito').filter(`:contains("${base.cliente.nome}")`).should('have.length', 2);
      abrirBloco(base.cliente.nome, 0);
      cy.get('dialog[open] [role="alert"]').should('contain', 'Conflito de horário');
    });
  });

  it('CT-15 [positivo] atividades em sequência (fim = início seguinte) não são conflito: valor-limite', () => {
    cy.cenarioBase().then((base) => {
      const dia = hojeSP();
      cy.criarOs(base, { data: dia, inicio: '15:00', fim: '16:00' }).then((a) => {
        cy.criarOs(base, { data: dia, inicio: '16:00', fim: '17:00' }).then((b) => {
          expect(b.status).to.eq(201);
          expect(b.body.aviso_conflito, 'colada no fim da anterior').to.eq(false);
          cy.chamarApi('GET', `/api/os/${a.body.id}`).its('body.atividades.0.conflito').should('eq', false);
        });
      });
    });
  });

  it('CT-16 [negativo] não exclui cliente que possui OS (RN 42) e mantém o cadastro', () => {
    cy.cenarioBase().then((base) => {
      cy.criarOs(base, { data: hojeSP(), inicio: '18:00', fim: '19:00' }).its('status').should('eq', 201);

      cy.visit(`/clientes/${base.cliente.id}`);
      cy.get('button[aria-label="Excluir cliente"]').click();
      cy.get('dialog[open]').contains('button', 'Excluir cliente').click();

      cy.get('dialog[open] [role="alert"]').should('have.text', 'Este cliente tem OS vinculada e não pode ser excluído.');
      cy.chamarApi('GET', `/api/clientes/${base.cliente.id}`).its('status').should('eq', 200);
    });
  });

  it('CT-17 [negativo] a API recusa OS cujo horário de fim não é posterior ao início', () => {
    cy.cenarioBase().then((base) => {
      cy.criarOs(base, { data: hojeSP(), inicio: '11:00', fim: '11:00' }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body.erro).to.eq('O horário de fim precisa ser depois do início (1ª atividade).');
      });
    });
  });
});
