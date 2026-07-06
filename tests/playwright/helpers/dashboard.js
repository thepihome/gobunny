const { waitForDashboardReady } = require('./navigation');

function dashboardTab(page, name) {
  return page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('button', { name, exact: true });
}

function kpiModal(page) {
  return page.locator('.modal-content');
}

module.exports = { dashboardTab, kpiModal, waitForDashboardReady };
