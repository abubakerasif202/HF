const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['final.spec.cjs', 'targeted-regression.spec.cjs'],
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: `${__dirname}/html-report`, open: 'never' }]],
  use: { browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  outputDir: `${__dirname}/test-results`,
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
