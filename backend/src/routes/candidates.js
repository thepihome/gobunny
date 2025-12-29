/**
 * Candidates routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleCandidates(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get assigned candidates (for consultants)
  if (path === '/api/candidates/assigned' && method === 'GET') {
    const authCheck = authorize('consultant', 'admin')(user);
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

    try {
      // For SQLite, we need to use subqueries for COUNT(DISTINCT) in GROUP BY
      const candidates = await query(
        env,
        `SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.phone, 
          u.created_at,
          ca.assigned_at, 
          ca.status as assignment_status,
          (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
          (SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) as match_count,
          cp.current_job_title, 
          cp.current_company, 
          cp.years_of_experience, 
          cp.availability
        FROM consultant_assignments ca
        JOIN users u ON ca.candidate_id = u.id
        LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
        WHERE ca.consultant_id = ?
        ORDER BY ca.assigned_at DESC`,
        [user.id]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching assigned candidates:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Get all candidates (admin only)
  if (path === '/api/candidates' && method === 'GET') {
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

    try {
      const candidates = await query(
        env,
        `SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.phone, 
          u.role, 
          u.is_active, 
          u.created_at,
          (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
          (SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) as match_count,
          cp.current_job_title, 
          cp.current_company, 
          cp.years_of_experience, 
          cp.availability
        FROM users u
        LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
        WHERE u.role = 'candidate'
        ORDER BY u.created_at DESC`
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching candidates:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Get candidate details
  const candidateDetailMatch = path.match(/^\/api\/candidates\/(\d+)$/);
  if (candidateDetailMatch && method === 'GET') {
    const candidateId = candidateDetailMatch[1];
    const authCheck = authorize('consultant', 'admin')(user);
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

    try {
      // Check if consultant has access to this candidate
      if (user.role === 'consultant') {
        const assignmentCheck = await queryOne(
          env,
          'SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?',
          [user.id, candidateId]
        );
        if (!assignmentCheck) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Access denied' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            request
          );
        }
      }

      const candidate = await queryOne(
        env,
        'SELECT id, first_name, last_name, email, phone, created_at FROM users WHERE id = ? AND role = ?',
        [candidateId, 'candidate']
      );

      if (!candidate) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Candidate not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Get resumes
      const resumes = await query(
        env,
        'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC',
        [candidateId]
      );

      // Get matches
      const matches = await query(
        env,
        `SELECT jm.*, j.title, j.company, j.location, j.status as job_status
         FROM job_matches jm
         JOIN jobs j ON jm.job_id = j.id
         WHERE jm.candidate_id = ?
         ORDER BY jm.match_score DESC`,
        [candidateId]
      );

      // Get CRM interactions
      const crmInteractions = await query(
        env,
        'SELECT * FROM crm_contacts WHERE candidate_id = ? ORDER BY interaction_date DESC',
        [candidateId]
      );

      // Get candidate profile
      const profile = await queryOne(
        env,
        'SELECT * FROM candidate_profiles WHERE user_id = ?',
        [candidateId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            ...candidate,
            resumes: resumes || [],
            matches: matches || [],
            crm_interactions: crmInteractions || [],
            profile: profile || null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching candidate details:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Assign candidate to consultant (admin only)
  const assignMatch = path.match(/^\/api\/candidates\/(\d+)\/assign$/);
  if (assignMatch && method === 'POST') {
    const candidateId = assignMatch[1];
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

    try {
      const body = await request.json();
      const { consultant_id } = body;

      // Verify consultant exists
      const consultant = await queryOne(
        env,
        'SELECT id FROM users WHERE id = ? AND role IN (?, ?)',
        [consultant_id, 'consultant', 'admin']
      );
      if (!consultant) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Consultant not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if already assigned
      const existingAssignment = await queryOne(
        env,
        'SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?',
        [consultant_id, candidateId]
      );

      if (existingAssignment) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Candidate already assigned to this consultant' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const result = await execute(
        env,
        'INSERT INTO consultant_assignments (consultant_id, candidate_id) VALUES (?, ?)',
        [consultant_id, candidateId]
      );

      const assignment = await queryOne(
        env,
        'SELECT * FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?',
        [consultant_id, candidateId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(assignment),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error assigning candidate:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Unassign candidate from consultant (admin only)
  const unassignMatch = path.match(/^\/api\/candidates\/(\d+)\/assign\/(\d+)$/);
  if (unassignMatch && method === 'DELETE') {
    const candidateId = unassignMatch[1];
    const consultantId = unassignMatch[2];
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

    try {
      const assignment = await queryOne(
        env,
        'SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?',
        [consultantId, candidateId]
      );

      if (!assignment) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Assignment not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      await execute(
        env,
        'DELETE FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?',
        [consultantId, candidateId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Candidate unassigned successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error unassigning candidate:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Not found
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}
