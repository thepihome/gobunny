const { test, expect } = require('../fixtures/test-fixtures');
const { gotoApp, waitForDashboardReady } = require('../helpers/navigation');

test.describe('Smoke — public shell', () => {
  test('login page loads with GoBunny branding', async ({ page }) => {
    await gotoApp(page, '/login');
    await expect(page.getByRole('heading', { name: 'GoBunny' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Use your Google account to access the GoBunny platform')).toBeVisible();
  });

  test('unauthenticated users are redirected to login', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});

test.describe('Smoke — authenticated pages', () => {
  test('dashboard renders for admin', async ({ authedPage, role }) => {
    test.skip(role !== 'admin', 'Admin-only smoke check');
    await gotoApp(authedPage, '/');
    await waitForDashboardReady(authedPage);
    await expect(authedPage.getByRole('navigation', { name: 'Dashboard sections' })).toBeVisible();
  });

  test('sidebar navigation is visible', async ({ authedPage }) => {
    await gotoApp(authedPage, '/');
    await waitForDashboardReady(authedPage);
    await expect(authedPage.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(authedPage.getByRole('link', { name: 'Jobs' })).toBeVisible();
    await expect(authedPage.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('jobs page loads', async ({ authedPage }) => {
    await gotoApp(authedPage, '/jobs');
    await expect(authedPage.getByRole('heading', { name: 'Job Openings' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('settings page loads', async ({ authedPage }) => {
    await gotoApp(authedPage, '/settings');
    await expect(authedPage.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });
});
