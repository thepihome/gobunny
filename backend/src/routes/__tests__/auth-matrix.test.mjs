import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_ENV = { FRONTEND_URL: 'http://localhost:3000', JWT_SECRET: 'test-secret' };

function makeRequest(path, { method = 'GET', body = null } = {}) {
  const init = { method };
  if (body !== null) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(`https://example.com${path}`, init);
}

async function readJson(response) {
  return { status: response.status, body: JSON.parse(await response.text()) };
}

/** Minimal D1 stub for route handler tests */
function createMockEnv({ queryRows = [] } = {}) {
  const resolveRows = typeof queryRows === 'function' ? queryRows : () => queryRows;
  return {
    ...BASE_ENV,
    DB: {
      prepare: (sql) => {
        const stmt = {
          all: async () => ({ results: resolveRows(sql, []) }),
          bind: (...params) => ({
            all: async () => ({ results: resolveRows(sql, params) }),
            run: async () => ({ meta: { last_row_id: 1 }, success: true }),
          }),
        };
        return stmt;
      },
    },
  };
}

describe('auth matrix — route handlers', () => {
  describe('handleUsers', () => {
    it('denies non-admin from GET /api/users', async () => {
      const { handleUsers } = await import('../users.js');
      const res = await handleUsers(
        makeRequest('/api/users'),
        createMockEnv(),
        { id: 2, role: 'candidate' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /permissions/i);
    });

    it('allows admin to GET /api/users', async () => {
      const { handleUsers } = await import('../users.js');
      const res = await handleUsers(
        makeRequest('/api/users'),
        createMockEnv({ queryRows: [{ id: 1, email: 'a@test.com', role: 'admin' }] }),
        { id: 1, role: 'admin' }
      );
      assert.equal(res.status, 200);
    });

    it('allows self GET /api/users/:id', async () => {
      const { handleUsers } = await import('../users.js');
      const env = createMockEnv({
        queryRows: (sql) => {
          if (sql.includes('FROM users u') && sql.includes('WHERE u.id')) {
            return [{ id: 5, email: 'c@test.com', role: 'candidate', first_name: 'C', last_name: 'U' }];
          }
          return [];
        },
      });
      const res = await handleUsers(makeRequest('/api/users/5'), env, { id: 5, role: 'candidate' });
      assert.equal(res.status, 200);
    });

    it('denies other-user GET /api/users/:id', async () => {
      const { handleUsers } = await import('../users.js');
      const res = await handleUsers(
        makeRequest('/api/users/99'),
        createMockEnv(),
        { id: 5, role: 'candidate' }
      );
      assert.equal(res.status, 403);
    });

    it('denies non-admin DELETE /api/users/:id', async () => {
      const { handleUsers } = await import('../users.js');
      const res = await handleUsers(
        makeRequest('/api/users/2', { method: 'DELETE' }),
        createMockEnv(),
        { id: 5, role: 'consultant' }
      );
      assert.equal(res.status, 403);
    });
  });

  describe('handleResumes', () => {
    const OTHER_USER_RESUME = {
      id: 42,
      user_id: 99,
      file_name: 'resume.pdf',
      content_text: 'Experienced engineer with JavaScript skills.',
      structured_content: null,
      skills: '[]',
      experience_years: 5,
      education: '',
      summary: 'Engineer',
    };

    function createResumeEnv(resumeRow) {
      return createMockEnv({
        queryRows: (sql, params) => {
          const resumeId = params?.[0] != null ? String(params[0]) : null;
          if (!resumeId || String(resumeRow.id) !== resumeId) return [];

          if (sql.includes('FROM resumes r') && sql.includes('JOIN users')) {
            return [
              {
                ...resumeRow,
                first_name: 'Other',
                last_name: 'Candidate',
                email: 'other@test.com',
              },
            ];
          }
          if (sql.includes('FROM resumes')) {
            if (sql.includes('user_id') && !sql.includes('SELECT r.*')) {
              return [{ user_id: resumeRow.user_id }];
            }
            return [resumeRow];
          }
          return [];
        },
      });
    }

    it('denies non-admin POST upload-for-candidate', async () => {
      const { handleResumes } = await import('../resumes.js');
      const res = await handleResumes(
        makeRequest('/api/resumes/upload-for-candidate/3', { method: 'POST' }),
        createMockEnv(),
        { id: 5, role: 'consultant' }
      );
      assert.equal(res.status, 403);
    });

    it('denies candidate GET another users resume', async () => {
      const { handleResumes } = await import('../resumes.js');
      const res = await handleResumes(
        makeRequest('/api/resumes/42'),
        createResumeEnv(OTHER_USER_RESUME),
        { id: 5, role: 'candidate' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /access denied/i);
    });

    it('allows candidate GET own resume', async () => {
      const { handleResumes } = await import('../resumes.js');
      const ownResume = { ...OTHER_USER_RESUME, user_id: 5 };
      const res = await handleResumes(
        makeRequest('/api/resumes/42'),
        createResumeEnv(ownResume),
        { id: 5, role: 'candidate' }
      );
      assert.equal(res.status, 200);
    });

    it('allows consultant GET any resume', async () => {
      const { handleResumes } = await import('../resumes.js');
      const res = await handleResumes(
        makeRequest('/api/resumes/42'),
        createResumeEnv(OTHER_USER_RESUME),
        { id: 7, role: 'consultant' }
      );
      assert.equal(res.status, 200);
    });

    it('denies candidate POST analyze on another users resume', async () => {
      const { handleResumes } = await import('../resumes.js');
      const res = await handleResumes(
        makeRequest('/api/resumes/42/analyze', { method: 'POST', body: { draft_only: true } }),
        createResumeEnv(OTHER_USER_RESUME),
        { id: 5, role: 'candidate' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /access denied/i);
    });

    it('denies consultant PUT on another users resume', async () => {
      const { handleResumes } = await import('../resumes.js');
      const res = await handleResumes(
        makeRequest('/api/resumes/42', {
          method: 'PUT',
          body: { summary: 'Updated by consultant' },
        }),
        createResumeEnv(OTHER_USER_RESUME),
        { id: 7, role: 'consultant' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /access denied/i);
    });
  });

  describe('handleMatches POST /match', () => {
    it('denies candidate matching another users resume', async () => {
      const { handleMatches } = await import('../matches.js');
      const env = createMockEnv({
        queryRows: (sql) => {
          if (sql.includes('FROM resumes')) {
            return [{ id: 1, user_id: 99, skills: '[]', experience_years: 3 }];
          }
          if (sql.includes('FROM jobs')) {
            return [{ id: 2, required_skills: '[]', preferred_skills: '[]' }];
          }
          return [];
        },
      });
      const res = await handleMatches(
        makeRequest('/api/matches/match', {
          method: 'POST',
          body: { resume_id: 1, job_id: 2 },
        }),
        env,
        { id: 5, role: 'candidate' }
      );
      assert.equal(res.status, 403);
    });
  });

  describe('handleCRM POST', () => {
    it('denies consultant CRM for unassigned candidate', async () => {
      const { handleCRM } = await import('../crm.js');
      const env = createMockEnv({
        queryRows: (sql) => (sql.includes('consultant_assignments') ? [] : []),
      });
      const res = await handleCRM(
        makeRequest('/api/crm', {
          method: 'POST',
          body: {
            candidate_id: 10,
            interaction_type: 'call',
            interaction_date: '2026-06-14',
          },
        }),
        env,
        { id: 7, role: 'consultant' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /assigned/i);
    });

    it('allows admin CRM without assignment check', async () => {
      const { handleCRM } = await import('../crm.js');
      const env = createMockEnv({
        queryRows: (sql) => {
          if (sql.includes('FROM crm_contacts c')) {
            return [{ id: 1, consultant_id: 1, candidate_id: 10, interaction_type: 'call' }];
          }
          return [];
        },
      });
      const res = await handleCRM(
        makeRequest('/api/crm', {
          method: 'POST',
          body: {
            candidate_id: 10,
            interaction_type: 'call',
            interaction_date: '2026-06-14',
          },
        }),
        env,
        { id: 1, role: 'admin' }
      );
      assert.equal(res.status, 201);
    });
  });

  describe('handleTimesheets POST', () => {
    it('denies consultant timesheet for unassigned candidate', async () => {
      const { handleTimesheets } = await import('../timesheets.js');
      const env = createMockEnv({
        queryRows: (sql) => (sql.includes('consultant_assignments') ? [] : []),
      });
      const res = await handleTimesheets(
        makeRequest('/api/timesheets', {
          method: 'POST',
          body: { candidate_id: 10, date: '2026-06-14', hours: 8 },
        }),
        env,
        { id: 7, role: 'consultant' }
      );
      const { status, body } = await readJson(res);
      assert.equal(status, 403);
      assert.match(body.error, /assigned/i);
    });
  });
});

describe('auth matrix — router health/db', () => {
  it('rejects unauthenticated GET /api/health/db', async () => {
    const { handleRequest } = await import('../../router.js');
    const res = await handleRequest(makeRequest('/api/health/db'), BASE_ENV, {});
    assert.equal(res.status, 401);
  });

  it('rejects invalid token GET /api/health/db', async () => {
    const { handleRequest } = await import('../../router.js');
    const res = await handleRequest(
      new Request('https://example.com/api/health/db', {
        headers: { Authorization: 'Bearer not-a-real-token' },
      }),
      BASE_ENV,
      {}
    );
    assert.ok([401, 403].includes(res.status));
  });
});
