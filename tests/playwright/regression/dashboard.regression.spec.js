const { test, expect } = require('../fixtures/test-fixtures');
const { dashboardTab, kpiModal, waitForDashboardReady } = require('../helpers/dashboard');

test.describe('Regression — dashboard & KPIs', () => {
  test('overview shows summary, quick actions, and KPI preview', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await expect(authedPage.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: 'Key Metrics' })).toBeVisible();
    await expect(authedPage.getByRole('heading', { name: 'Active Jobs' })).toBeVisible();
  });

  test('KPI tab lists metrics with values', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await dashboardTab(authedPage, 'KPIs').click();
    await expect(authedPage.getByRole('heading', { name: 'Active Jobs' })).toBeVisible();
    await expect(authedPage.getByText('12').first()).toBeVisible();
  });

  test('custom filter KPI navigates to candidates', async ({ authedPage, role }) => {
    test.skip(role === 'candidate', 'Custom filter KPI is consultant/admin');

    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await dashboardTab(authedPage, 'KPIs').click();
    await authedPage.getByText('Filtered Pool').click();
    await expect(authedPage).toHaveURL(/\/candidates/);
  });

  test('open create KPI modal', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await authedPage.getByRole('button', { name: /Add KPI/i }).click();
    const modal = kpiModal(authedPage);
    await expect(modal.getByRole('heading', { name: /Create KPI/i })).toBeVisible();
    await expect(modal.locator('input[type="text"]').first()).toBeVisible();
    await expect(modal.locator('select')).toBeVisible();
  });

  test('analytics tab renders chart cards', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await dashboardTab(authedPage, 'Analytics').click();
    await expect(authedPage.getByText('Jobs by Status')).toBeVisible();
    await expect(authedPage.locator('.chart-card').first()).toBeVisible();
  });

  test('refresh analytics button is clickable', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await authedPage.getByRole('button', { name: /Refresh/i }).click();
    await expect(authedPage.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  });

  test('quick action navigates to jobs', async ({ authedPage }) => {
    await authedPage.goto('/');
    await waitForDashboardReady(authedPage);
    await authedPage.getByRole('button', { name: /Browse Jobs|Jobs/i }).first().click();
    await expect(authedPage).toHaveURL(/\/jobs/);
  });
});
