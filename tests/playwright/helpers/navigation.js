const { expect } = require('@playwright/test');

async function gotoApp(page, path = '/') {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  const body = await page.locator('body').innerText();
  if (body.includes('The requested path could not be found')) {
    throw new Error(
      `${path} returned a static 404. Use SPA mode (npx serve -s build) or npm start.`
    );
  }
  return response;
}

async function waitForDashboardReady(page) {
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible({
    timeout: 30_000,
  });
}

module.exports = { gotoApp, waitForDashboardReady };
