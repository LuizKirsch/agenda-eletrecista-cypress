const { defineConfig } = require('cypress');

// Configuração da suíte E2E. O servidor de teste (scripts/servidor-teste.js) sobe na porta 3100
// com um banco SQLite descartável, então nada aqui toca nos dados de desenvolvimento/produção.
module.exports = defineConfig({
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'relatorios',
    reportPageTitle: 'Relatório E2E - Agenda do Eletricista',
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
    saveAllAttempts: false,
  },
  video: true,
  screenshotOnRunFailure: true,
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3100',
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    // Usuário secretária: padrão do banco local de teste; no CI vem dos segredos do repositório.
    // Lido com Cypress.expose(); a senha nunca é digitada nem enviada com log ligado.
    expose: {
      secretariaLogin: process.env.SECRETARIA_LOGIN || 'maria',
      secretariaSenha: process.env.SECRETARIA_SENHA || 'Teste@123',
    },
    setupNodeEvents(on) {
      require('cypress-mochawesome-reporter/plugin')(on);
    },
  },
});
