/**
 * Jobs routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleJobs(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get all jobs
  if (path === '/api/jobs' && method === 'GET') {
    try {
      const { searchParams } = url;
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const location = searchParams.get('location');
      const employment_type = searchParams.get('employment_type');
      const include_deleted = searchParams.get('include_deleted');

      let sql = 'SELECT * FROM jobs WHERE 1=1';
      const params = [];

      if (include_deleted !== 'true') {
        sql += " AND status != 'deleted'";
      }

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      if (search) {
        sql += ' AND (title LIKE ? OR description LIKE ? OR company LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (location) {
        sql += ' AND location LIKE ?';
        params.push(`%${location}%`);
      }

      if (employment_type) {
        sql += ' AND employment_type = ?';
        params.push(employment_type);
      }

      sql += ' ORDER BY created_at DESC';

      const results = await query(env, sql, params);

      // Parse JSON fields
      const jobs = results.map(job => {
        if (job.required_skills) {
          try {
            job.required_skills = JSON.parse(job.required_skills);
          } catch (e) {
            job.required_skills = [];
          }
        }
        if (job.preferred_skills) {
          try {
            job.preferred_skills = JSON.parse(job.preferred_skills);
          } catch (e) {
            job.preferred_skills = [];
          }
        }
        return job;
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify(jobs),
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
      const job = await queryOne(env, 'SELECT * FROM jobs WHERE id = ?', [jobId]);

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
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
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
        title, description, company, location, salary_min, salary_max,
        employment_type, required_skills, preferred_skills, experience_level,
        external_apply_link, status,
      } = body;

      const result = await execute(
        env,
        `INSERT INTO jobs (title, description, company, location, salary_min, salary_max,
         employment_type, required_skills, preferred_skills, experience_level, external_apply_link, status, posted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, description, company, location, salary_min, salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : '[]',
          preferred_skills ? JSON.stringify(preferred_skills) : '[]',
          experience_level, external_apply_link || null,
          status || 'active', user.id,
        ]
      );

      const jobId = result.meta.last_row_id;
      const job = await queryOne(env, 'SELECT * FROM jobs WHERE id = ?', [jobId]);

      // Parse JSON fields
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
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
        title, description, company, location, salary_min, salary_max,
        employment_type, required_skills, preferred_skills, experience_level,
        external_apply_link, status,
      } = body;

      await execute(
        env,
        `UPDATE jobs SET title = ?, description = ?, company = ?, location = ?,
         salary_min = ?, salary_max = ?, employment_type = ?, required_skills = ?,
         preferred_skills = ?, experience_level = ?, external_apply_link = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          title, description, company, location, salary_min, salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : '[]',
          preferred_skills ? JSON.stringify(preferred_skills) : '[]',
          experience_level, external_apply_link || null, status, jobId,
        ]
      );

      const job = await queryOne(env, 'SELECT * FROM jobs WHERE id = ?', [jobId]);

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
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
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

