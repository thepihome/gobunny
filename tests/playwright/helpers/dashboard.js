const { expect } = require('@playwright/test');

function dashboardTab(page, name) {
  return page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('button', { name, exact: true });
}

function kpiModal(page) {
  return page.locator('.modal-content');
}

async function waitForDashboardReady(page) {
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible({
    timeout: 30_000,
  });
}

module.exports = { dashboardTab, kpiModal, waitForDashboardReady };
