const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'baseline.spec.cjs',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: `${__dirname}/html-report`, open: 'never' }]],
  use: {
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: `${__dirname}/test-results`,
});
