const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { defineConfig } = require('@playwright/test');
const { config } = require('./helpers/config');

module.exports = defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.js'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  globalSetup: require.resolve('./global-setup'),
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: config.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: {
    timeout: 15_000,
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true'
    ? undefined
    : {
        command:
          process.env.PLAYWRIGHT_WEB_COMMAND ||
          'npx --yes serve -s build -l 3000',
        cwd: path.join(__dirname, '../../frontend'),
        url: `${config.baseURL.replace(/\/$/, '')}/login`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  outputDir: path.join(__dirname, 'test-results'),
});
