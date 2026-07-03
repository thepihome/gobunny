/**
 * Register Candidates routes (read-only) using secondary D1 database REGISTER_DB
 */

import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import { query } from '../utils/db.js';

async function registerQuery(env, sql, params = []) {
  let stmt = env.REGISTER_DB.prepare(sql);
  if (params.length > 0) {
    stmt = stmt.bind(...params);
  }
  const result = await stmt.all();
  return result.results || [];
}

export async function handleRegisterCandidates(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Only admins can access this endpoint for now (tab visibility is controlled via permissions/groups)
  const authCheck = authorize('admin')(user);
  if (authCheck) {
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: authCheck.error }),
        { status: authCheck.status || 403, headers: { 'Content-Type': 'application/json' } }
      ),
      env,
      request
    );
  }

  // List all register candidates (?exclude_onboarded=1 omits rows already created as platform candidates)
  if (path === '/api/register-candidates' && method === 'GET') {
    try {
      const excludeOnboarded =
        url.searchParams.get('exclude_onboarded') === '1' ||
        url.searchParams.get('exclude_onboarded') === 'true';

      const rows = await registerQuery(
        env,
        'SELECT * FROM register_candidates ORDER BY created_at DESC'
      );

      let result = rows || [];

      if (excludeOnboarded && result.length > 0) {
        const existing = await query(
          env,
          `SELECT LOWER(TRIM(email)) AS email FROM users
           WHERE role = 'candidate' AND email IS NOT NULL AND TRIM(email) != ''`
        );
        const onboardedEmails = new Set(
          existing.map((row) => row.email).filter(Boolean)
        );
        result = result.filter((row) => {
          const email = String(row.email || '').trim().toLowerCase();
          if (!email) return true;
          return !onboardedEmails.has(email);
        });
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(result),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching register_candidates from external DB:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  const detailMatch = path.match(/^\/api\/register-candidates\/(\d+)$/);
  if (detailMatch && method === 'GET') {
    try {
      const id = detailMatch[1];
      const rows = await registerQuery(
        env,
        'SELECT * FROM register_candidates WHERE id = ? LIMIT 1',
        [id]
      );
      const row = rows[0];
      if (!row) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Register record not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      return addCorsHeaders(
        new Response(JSON.stringify(row), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching register candidate by id:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

