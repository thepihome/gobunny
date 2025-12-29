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
      const { searchParams } = url;
      
      // Build WHERE clause with filters
      let whereConditions = ['ca.consultant_id = ?'];
      const params = [user.id];

      // Apply same filters as admin endpoint
      const search = searchParams.get('search');
      if (search) {
        whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR (cp.current_company IS NOT NULL AND cp.current_company LIKE ?))');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const city = searchParams.get('city');
      if (city) {
        whereConditions.push('(cp.city IS NOT NULL AND cp.city LIKE ?)');
        params.push(`%${city}%`);
      }

      const state = searchParams.get('state');
      if (state) {
        whereConditions.push('(cp.state IS NOT NULL AND cp.state LIKE ?)');
        params.push(`%${state}%`);
      }

      const country = searchParams.get('country');
      if (country) {
        whereConditions.push('(cp.country IS NOT NULL AND cp.country LIKE ?)');
        params.push(`%${country}%`);
      }

      const current_job_title = searchParams.get('current_job_title');
      if (current_job_title) {
        whereConditions.push('(cp.current_job_title IS NOT NULL AND cp.current_job_title LIKE ?)');
        params.push(`%${current_job_title}%`);
      }

      const current_company = searchParams.get('current_company');
      if (current_company) {
        whereConditions.push('(cp.current_company IS NOT NULL AND cp.current_company LIKE ?)');
        params.push(`%${current_company}%`);
      }

      const years_min = searchParams.get('years_of_experience_min');
      if (years_min) {
        whereConditions.push('(cp.years_of_experience IS NOT NULL AND cp.years_of_experience >= ?)');
        params.push(parseInt(years_min));
      }

      const years_max = searchParams.get('years_of_experience_max');
      if (years_max) {
        whereConditions.push('(cp.years_of_experience IS NOT NULL AND cp.years_of_experience <= ?)');
        params.push(parseInt(years_max));
      }

      const availability = searchParams.get('availability');
      if (availability) {
        whereConditions.push('(cp.availability IS NOT NULL AND cp.availability = ?)');
        params.push(availability);
      }

      const work_authorization = searchParams.get('work_authorization');
      if (work_authorization) {
        whereConditions.push('(cp.work_authorization IS NOT NULL AND cp.work_authorization LIKE ?)');
        params.push(`%${work_authorization}%`);
      }

      const willing_to_relocate = searchParams.get('willing_to_relocate');
      if (willing_to_relocate === 'true') {
        whereConditions.push('cp.willing_to_relocate = 1');
      } else if (willing_to_relocate === 'false') {
        whereConditions.push('(cp.willing_to_relocate = 0 OR cp.willing_to_relocate IS NULL)');
      }

      const has_resume = searchParams.get('has_resume');
      if (has_resume === 'true') {
        whereConditions.push('(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) > 0');
      } else if (has_resume === 'false') {
        whereConditions.push('(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) = 0');
      }

      const has_matches = searchParams.get('has_matches');
      if (has_matches === 'true') {
        whereConditions.push('(SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) > 0');
      } else if (has_matches === 'false') {
        whereConditions.push('(SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) = 0');
      }

      const whereClause = whereConditions.join(' AND ');
      console.log('Assigned candidates SQL WHERE clause:', whereClause);
      console.log('Assigned candidates SQL params:', params);

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
        WHERE ${whereClause}
        ORDER BY ca.assigned_at DESC`,
        params
      );

      console.log('Assigned candidates query result count:', candidates?.length || 0);

      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching assigned candidates:', error);
      console.error('Error stack:', error.stack);
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
      const { searchParams } = url;
      
      console.log('Candidates filter params:', Array.from(searchParams.entries()));
      
      // Build WHERE clause with filters
      let whereConditions = ["u.role = 'candidate'"];
      const params = [];

      // Search filter (name, email, company)
      const search = searchParams.get('search');
      if (search) {
        whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR (cp.current_company IS NOT NULL AND cp.current_company LIKE ?))');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Location filters (handle NULL profiles)
      const city = searchParams.get('city');
      if (city) {
        whereConditions.push('(cp.city IS NOT NULL AND cp.city LIKE ?)');
        params.push(`%${city}%`);
      }

      const state = searchParams.get('state');
      if (state) {
        whereConditions.push('(cp.state IS NOT NULL AND cp.state LIKE ?)');
        params.push(`%${state}%`);
      }

      const country = searchParams.get('country');
      if (country) {
        whereConditions.push('(cp.country IS NOT NULL AND cp.country LIKE ?)');
        params.push(`%${country}%`);
      }

      // Job filters
      const current_job_title = searchParams.get('current_job_title');
      if (current_job_title) {
        whereConditions.push('(cp.current_job_title IS NOT NULL AND cp.current_job_title LIKE ?)');
        params.push(`%${current_job_title}%`);
      }

      const current_company = searchParams.get('current_company');
      if (current_company) {
        whereConditions.push('(cp.current_company IS NOT NULL AND cp.current_company LIKE ?)');
        params.push(`%${current_company}%`);
      }

      // Experience filters
      const years_min = searchParams.get('years_of_experience_min');
      if (years_min) {
        whereConditions.push('(cp.years_of_experience IS NOT NULL AND cp.years_of_experience >= ?)');
        params.push(parseInt(years_min));
      }

      const years_max = searchParams.get('years_of_experience_max');
      if (years_max) {
        whereConditions.push('(cp.years_of_experience IS NOT NULL AND cp.years_of_experience <= ?)');
        params.push(parseInt(years_max));
      }

      // Availability
      const availability = searchParams.get('availability');
      if (availability) {
        whereConditions.push('(cp.availability IS NOT NULL AND cp.availability = ?)');
        params.push(availability);
      }

      // Work authorization
      const work_authorization = searchParams.get('work_authorization');
      if (work_authorization) {
        whereConditions.push('(cp.work_authorization IS NOT NULL AND cp.work_authorization LIKE ?)');
        params.push(`%${work_authorization}%`);
      }

      // Willing to relocate
      const willing_to_relocate = searchParams.get('willing_to_relocate');
      if (willing_to_relocate === 'true') {
        whereConditions.push('cp.willing_to_relocate = 1');
      } else if (willing_to_relocate === 'false') {
        whereConditions.push('(cp.willing_to_relocate = 0 OR cp.willing_to_relocate IS NULL)');
      }

      // Has resume
      const has_resume = searchParams.get('has_resume');
      if (has_resume === 'true') {
        whereConditions.push('(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) > 0');
      } else if (has_resume === 'false') {
        whereConditions.push('(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) = 0');
      }

      // Has matches
      const has_matches = searchParams.get('has_matches');
      if (has_matches === 'true') {
        whereConditions.push('(SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) > 0');
      } else if (has_matches === 'false') {
        whereConditions.push('(SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) = 0');
      }

      // Active status
      const is_active = searchParams.get('is_active');
      if (is_active === 'true') {
        whereConditions.push('u.is_active = 1');
      } else if (is_active === 'false') {
        whereConditions.push('u.is_active = 0');
      }

      const whereClause = whereConditions.join(' AND ');
      console.log('SQL WHERE clause:', whereClause);
      console.log('SQL params:', params);

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
        WHERE ${whereClause}
        ORDER BY u.created_at DESC`,
        params
      );

      console.log('Candidates query result count:', candidates?.length || 0);

      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching candidates:', error);
      console.error('Error stack:', error.stack);
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
