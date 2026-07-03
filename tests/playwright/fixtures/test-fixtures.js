const { test: base, expect } = require('@playwright/test');
const { config } = require('../helpers/config');
const { USERS, getMockResponse } = require('../helpers/api-mocks');

async function seedAuth(page, role) {
  const user = USERS[role] || USERS.admin;
  await page.addInitScript(
    ({ token, userData }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    },
    { token: 'local-playwright-test-token', userData: user }
  );
}

async function mockApi(page, role) {
  const apiPattern = `${config.apiURL.replace(/\/$/, '')}/**`;
  await page.route(apiPattern, async (route) => {
    const mock = getMockResponse(route.request(), role);
    if (mock) {
      await route.fulfill(mock);
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unmocked API route in Playwright tests', url: route.request().url() }),
      });
    }
  });
}

const test = base.extend({
  role: [config.testRole, { option: true }],
  authedPage: async ({ page, role }, use) => {
    await seedAuth(page, role);
    await mockApi(page, role);
    await use(page);
  },
});

module.exports = { test, expect, seedAuth, mockApi, USERS, config };
