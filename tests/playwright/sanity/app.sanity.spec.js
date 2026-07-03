const { test, expect } = require('../fixtures/test-fixtures');
const { dashboardTab, waitForDashboardReady } = require('../helpers/dashboard');

const ROLE_NAV = {
  admin: ['Dashboard', 'Jobs', 'Matches', 'Candidates', 'Timesheets', 'CRM', 'Metadata', 'Register', 'Settings'],
  consultant: ['Dashboard', 'Jobs', 'Matches', 'Candidates', 'Timesheets', 'CRM', 'Settings'],
  candidate: ['Dashboard', 'Jobs', 'My Resumes', 'Matches', 'Settings'],
};

test.describe('Sanity — critical paths', () => {
  test('auth session opens dashboard', async ({ authedPage }) => {
    await authedPage.goto('/');
    await expect(authedPage.getByText('GoBunny')).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Logout/i })).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  });

  test('role-appropriate navigation items are shown', async ({ authedPage, role }) => {
    await authedPage.goto('/');
    const expected = ROLE_NAV[role] || ROLE_NAV.admin;

    for (const label of expected) {
      await expect(authedPage.getByRole('link', { name: label })).toBeVisible();
    }

    if (role === 'candidate') {
      await expect(authedPage.getByRole('link', { name: 'Candidates' })).toHaveCount(0);
      await expect(authedPage.getByRole('link', { name: 'CRM' })).toHaveCount(0);
    }

    if (role !== 'admin') {
      await expect(authedPage.getByRole('link', { name: 'Metadata' })).toHaveCount(0);
      await expect(authedPage.getByRole('link', { name: 'Register' })).toHaveCount(0);
    }
  });

  test('dashboard tabs switch content', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await dashboardTab(authedPage, 'KPIs').click();
    await expect(authedPage.locator('.kpi-grid')).toBeVisible();

    await dashboardTab(authedPage, 'Analytics').click();
    await expect(authedPage.getByText(/Interactive business intelligence/i)).toBeVisible();
  });

  test('logout returns to login', async ({ authedPage }) => {
    await authedPage.goto('/');
    await authedPage.getByRole('button', { name: /Logout/i }).click();
    await expect(authedPage).toHaveURL(/\/login/);
    await expect(authedPage.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('navbar brand navigates home', async ({ authedPage }) => {
    await authedPage.goto('/jobs');
    await authedPage.getByRole('link', { name: /GoBunny/i }).click();
    await expect(authedPage).toHaveURL(/\/(\?.*)?$/);
  });
});
