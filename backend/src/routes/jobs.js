/**
 * Jobs routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import { normalizeListingType, parseJobJsonFields } from '../utils/jobListing.js';

function mapJobs(rows) {
  return rows.map((job) => parseJobJsonFields(job));
}

export async function handleJobs(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Browse all active jobs (candidates — fit check before apply)
  if (path === '/api/jobs/opportunities' && method === 'GET') {
    try {
      const { searchParams } = url;
      const search = searchParams.get('search');
      let sql = `SELECT j.*, jr.name as job_classification_name,
                 (SELECT jm.match_score FROM job_matches jm
                  WHERE jm.job_id = j.id AND jm.candidate_id = ? LIMIT 1) AS match_score
                 FROM jobs j
                 LEFT JOIN job_roles jr ON j.job_classification = jr.id
                 WHERE j.status = 'active'
                 AND j.listing_type IN ('internal', 'external')`;
      const params = [user.id];
      if (search) {
        sql += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.company LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      sql += ' ORDER BY j.created_at DESC LIMIT 100';
      const results = await query(env, sql, params);
      return addCorsHeaders(
        new Response(JSON.stringify(mapJobs(results)), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching job opportunities:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    }
  }

  // Get all jobs (candidate: matched jobs by default via /api/jobs; staff: full list)
  if (path === '/api/jobs' && method === 'GET') {
    try {
      const { searchParams } = url;
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const location = searchParams.get('location');
      const employment_type = searchParams.get('employment_type');
      const listing_type = searchParams.get('listing_type');
      const include_deleted = searchParams.get('include_deleted');

      const appendFilters = (sql, params) => {
        if (include_deleted !== 'true') {
          sql += " AND j.status != 'deleted'";
        }
        if (status) {
          sql += ' AND j.status = ?';
          params.push(status);
        }
        if (search) {
          sql += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.company LIKE ?)';
          const searchTerm = `%${search}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }
        if (location) {
          sql += ' AND j.location LIKE ?';
          params.push(`%${location}%`);
        }
        if (employment_type) {
          sql += ' AND j.employment_type = ?';
          params.push(employment_type);
        }
        if (listing_type) {
          sql += ' AND j.listing_type = ?';
          params.push(normalizeListingType(listing_type));
        }
        return { sql, params };
      };

      let sql;
      let params = [];

      if (user.role === 'candidate') {
        sql = `SELECT j.*, jr.name as job_classification_name, jm.match_score AS match_score
               FROM jobs j
               INNER JOIN job_matches jm ON j.id = jm.job_id AND jm.candidate_id = ?
               LEFT JOIN job_roles jr ON j.job_classification = jr.id
               WHERE j.status = 'active'`;
        params = [user.id];
        const f = appendFilters(sql, params);
        sql = f.sql;
        params = f.params;
        sql += ' ORDER BY jm.match_score DESC, j.created_at DESC';
      } else {
        const totalRow = await queryOne(
          env,
          `SELECT COUNT(*) as c FROM users u
           INNER JOIN candidate_profiles cp ON u.id = cp.user_id
           WHERE u.role = 'candidate' AND u.is_active = 1`
        );
        const totalCandidates = Math.max(1, Number(totalRow?.c || 0));

        sql = `SELECT j.*, jr.name as job_classification_name,
               (SELECT COUNT(DISTINCT jm.candidate_id) FROM job_matches jm WHERE jm.job_id = j.id) AS matched_candidate_count,
               ROUND(100.0 * (SELECT COUNT(DISTINCT jm.candidate_id) FROM job_matches jm WHERE jm.job_id = j.id) / ?, 1) AS match_percentage
               FROM jobs j
               LEFT JOIN job_roles jr ON j.job_classification = jr.id
               WHERE 1=1`;
        params = [totalCandidates];
        const f = appendFilters(sql, params);
        sql = f.sql;
        params = f.params;
        sql += ` ORDER BY (CAST((SELECT COUNT(DISTINCT jm.candidate_id) FROM job_matches jm WHERE jm.job_id = j.id) AS REAL) / ?) DESC, j.created_at DESC`;
        params.push(totalCandidates);
      }

      const results = await query(env, sql, params);
      return addCorsHeaders(
        new Response(
          JSON.stringify(mapJobs(results)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching jobs:', error);
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

  // Get single job
  const singleJobMatch = path.match(/^\/api\/jobs\/(\d+)$/);
  if (singleJobMatch && method === 'GET') {
    try {
      const jobId = singleJobMatch[1];
      let job;
      if (user.role === 'candidate') {
        job = await queryOne(
          env,
          `SELECT j.*, jr.name as job_classification_name,
           (SELECT jm.match_score FROM job_matches jm
            WHERE jm.job_id = j.id AND jm.candidate_id = ? LIMIT 1) AS match_score
           FROM jobs j
           LEFT JOIN job_roles jr ON j.job_classification = jr.id
           WHERE j.id = ? AND j.status = 'active'`,
          [user.id, jobId]
        );
      } else {
        job = await queryOne(
          env,
          `SELECT j.*, jr.name as job_classification_name
           FROM jobs j
           LEFT JOIN job_roles jr ON j.job_classification = jr.id
           WHERE j.id = ?`,
          [jobId]
        );
      }

      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Parse JSON fields
      return addCorsHeaders(
        new Response(
          JSON.stringify(parseJobJsonFields(job)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching job:', error);
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

  // Create job
  if (path === '/api/jobs' && method === 'POST') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const body = await request.json();
      const {
        title, job_classification, description, company, location, salary_min, salary_max,
        employment_type, required_skills, preferred_skills, experience_level,
        external_apply_link, status, listing_type,
      } = body;

      const resolvedListingType = normalizeListingType(listing_type, 'internal');

      const result = await execute(
        env,
        `INSERT INTO jobs (title, job_classification, description, company, location, salary_min, salary_max,
         employment_type, required_skills, preferred_skills, experience_level, external_apply_link,
         listing_type, status, posted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, job_classification || null, description, company, location, salary_min, salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : '[]',
          preferred_skills ? JSON.stringify(preferred_skills) : '[]',
          experience_level, external_apply_link || null,
          resolvedListingType,
          status || 'active', user.id,
        ]
      );

      const jobId = result.meta.last_row_id;
      const job = await queryOne(env, 
        `SELECT j.*, jr.name as job_classification_name 
         FROM jobs j 
         LEFT JOIN job_roles jr ON j.job_classification = jr.id 
         WHERE j.id = ?`, 
        [jobId]);

      // Auto-match candidates if job has classification
      if (job_classification) {
        try {
          const { autoMatchByClassification } = await import('./matches.js');
          await autoMatchByClassification(env, jobId);
        } catch (e) {
          console.error('Error auto-matching candidates:', e);
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(parseJobJsonFields(job)),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating job:', error);
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

  // Update job
  if (singleJobMatch && method === 'PUT') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const jobId = singleJobMatch[1];
      const body = await request.json();
      const {
        title, job_classification, description, company, location, salary_min, salary_max,
        employment_type, required_skills, preferred_skills, experience_level,
        external_apply_link, status, listing_type,
      } = body;

      const existing = await queryOne(env, 'SELECT listing_type FROM jobs WHERE id = ?', [jobId]);
      const resolvedListingType = listing_type != null
        ? normalizeListingType(listing_type)
        : normalizeListingType(existing?.listing_type, 'internal');

      await execute(
        env,
        `UPDATE jobs SET title = ?, job_classification = ?, description = ?, company = ?, location = ?,
         salary_min = ?, salary_max = ?, employment_type = ?, required_skills = ?,
         preferred_skills = ?, experience_level = ?, external_apply_link = ?, listing_type = ?,
         status = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          title, job_classification || null, description, company, location, salary_min, salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : '[]',
          preferred_skills ? JSON.stringify(preferred_skills) : '[]',
          experience_level, external_apply_link || null,
          resolvedListingType,
          status, jobId,
        ]
      );

      const job = await queryOne(env, 
        `SELECT j.*, jr.name as job_classification_name 
         FROM jobs j 
         LEFT JOIN job_roles jr ON j.job_classification = jr.id 
         WHERE j.id = ?`, 
        [jobId]);

      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (job_classification) {
        try {
          const { autoMatchByClassification } = await import('./matches.js');
          await autoMatchByClassification(env, jobId);
        } catch (e) {
          console.error('Error auto-matching candidates:', e);
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(parseJobJsonFields(job)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating job:', error);
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

  // Quick update listing visibility (internal / web / external)
  const listingTypeMatch = path.match(/^\/api\/jobs\/(\d+)\/listing-type$/);
  if (listingTypeMatch && method === 'PATCH') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: authError.error }), { status: authError.status, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    }
    try {
      const jobId = listingTypeMatch[1];
      const body = await request.json();
      const listing_type = normalizeListingType(body.listing_type);
      const existing = await queryOne(env, 'SELECT id FROM jobs WHERE id = ?', [jobId]);
      if (!existing) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      await execute(
        env,
        `UPDATE jobs SET listing_type = ?, updated_at = datetime('now') WHERE id = ?`,
        [listing_type, jobId]
      );
      const job = await queryOne(
        env,
        `SELECT j.*, jr.name as job_classification_name FROM jobs j
         LEFT JOIN job_roles jr ON j.job_classification = jr.id WHERE j.id = ?`,
        [jobId]
      );
      return addCorsHeaders(
        new Response(JSON.stringify(parseJobJsonFields(job)), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('PATCH job listing-type:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    }
  }

  // Delete job
  if (singleJobMatch && method === 'DELETE') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const jobId = singleJobMatch[1];
      await execute(
        env,
        "UPDATE jobs SET status = 'deleted', updated_at = datetime('now') WHERE id = ?",
        [jobId]
      );

      const job = await queryOne(env, 'SELECT id, status FROM jobs WHERE id = ?', [jobId]);

      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Job deleted successfully', job }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting job:', error);
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

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

