const { test, expect } = require('../fixtures/test-fixtures');

test.describe('Regression — navigation', () => {
  const routes = [
    { path: '/', heading: /Welcome back/ },
    { path: '/jobs', heading: 'Job Openings' },
    { path: '/matches', heading: 'Job Matches' },
    { path: '/settings', heading: 'Settings', exact: true },
  ];

  for (const route of routes) {
    test(`navigates to ${route.path}`, async ({ authedPage }) => {
      await authedPage.goto(route.path);
      await expect(authedPage.getByRole('heading', { name: route.heading, exact: route.exact ?? false })).toBeVisible();
    });
  }

  test('sidebar link highlights active route', async ({ authedPage }) => {
    await authedPage.goto('/jobs');
    const jobsLink = authedPage.getByRole('link', { name: 'Jobs' });
    await expect(jobsLink).toHaveClass(/active/);
  });
});

test.describe('Regression — role-specific routes', () => {
  test('admin can open metadata and register', async ({ authedPage, role }) => {
    test.skip(role !== 'admin', 'Admin routes');

    await authedPage.goto('/metadata');
    await expect(authedPage.getByRole('heading', { name: /Metadata/i })).toBeVisible();

    await authedPage.goto('/register');
    await expect(authedPage.getByRole('heading', { name: 'Register' })).toBeVisible();
  });

  test('consultant can open candidates, timesheets, and CRM', async ({ authedPage, role }) => {
    test.skip(role !== 'consultant' && role !== 'admin', 'Consultant routes');

    await authedPage.goto('/candidates');
    await expect(authedPage.locator('.candidates-page, .list-page')).toBeVisible();

    await authedPage.goto('/timesheets');
    await expect(authedPage.getByRole('heading', { name: 'Timesheets' })).toBeVisible();

    await authedPage.goto('/crm');
    await expect(authedPage.getByRole('heading', { name: 'CRM' })).toBeVisible();
  });

  test('candidate can open resumes', async ({ authedPage, role }) => {
    test.skip(role !== 'candidate', 'Candidate routes');

    await authedPage.goto('/resumes');
    await expect(authedPage.getByRole('heading', { name: 'My Resumes' })).toBeVisible();
  });
});
