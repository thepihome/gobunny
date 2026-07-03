const { test, expect } = require('../fixtures/test-fixtures');

test.describe('Regression — jobs', () => {
  test('jobs list shows sample job', async ({ authedPage }) => {
    await authedPage.goto('/jobs');
    await expect(authedPage.getByText('Senior Engineer')).toBeVisible();
    await expect(authedPage.getByText('GoBunny Labs')).toBeVisible();
  });

  test('job details page loads from list', async ({ authedPage }) => {
    await authedPage.goto('/jobs/1');
    await expect(authedPage.getByRole('heading', { name: 'Senior Engineer' })).toBeVisible();
  });
});

test.describe('Regression — matches', () => {
  test('matches page shows match data', async ({ authedPage }) => {
    await authedPage.goto('/matches');
    await expect(authedPage.getByRole('heading', { name: 'Job Matches' })).toBeVisible();
    await expect(authedPage.getByText('Senior Engineer').or(authedPage.getByText('GoBunny Labs'))).toBeVisible();
  });
});

test.describe('Regression — candidates', () => {
  test('candidates page loads for consultant', async ({ authedPage, role }) => {
    test.skip(role === 'candidate', 'Candidates not for candidate role');
    await authedPage.goto('/candidates');
    await expect(authedPage.getByText('Jane Doe')).toBeVisible();
  });
});

test.describe('Regression — resumes', () => {
  test('resumes page shows uploaded resume', async ({ authedPage, role }) => {
    test.skip(role !== 'candidate', 'Resumes are candidate-only');
    await authedPage.goto('/resumes');
    await expect(authedPage.getByRole('heading', { name: 'My Resumes' })).toBeVisible();
    await expect(authedPage.getByText('resume.pdf')).toBeVisible();
  });
});

test.describe('Regression — timesheets & CRM', () => {
  test('timesheets page lists entries', async ({ authedPage, role }) => {
    test.skip(role === 'candidate', 'Timesheets not for candidates');
    await authedPage.goto('/timesheets');
    await expect(authedPage.getByRole('heading', { name: 'Timesheets' })).toBeVisible();
  });

  test('CRM page loads interactions', async ({ authedPage, role }) => {
    test.skip(role === 'candidate', 'CRM not for candidates');
    await authedPage.goto('/crm');
    await expect(authedPage.getByRole('heading', { name: 'CRM' })).toBeVisible();
    await expect(authedPage.getByText(/Follow-up scheduled/i)).toBeVisible();
  });
});
