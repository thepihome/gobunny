/**
 * Public career site API — no JWT required.
 * Returns jobs where listing_type = 'web' and status = 'active'.
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import {
  buildCareerApiBase,
  formatCareerJobDetail,
  formatCareerJobListItem,
  parseJobJsonFields,
} from '../utils/jobListing.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const WEB_JOB_WHERE = "j.listing_type = 'web' AND j.status = 'active'";

export async function handleCareers(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const apiBase = buildCareerApiBase(request, env);

  const listMatch = path === '/api/careers/jobs';
  const detailMatch = path.match(/^\/api\/careers\/jobs\/(\d+)$/);
  const applyMatch = path.match(/^\/api\/careers\/jobs\/(\d+)\/apply$/);

  if (listMatch && method === 'GET') {
    try {
      const { searchParams } = url;
      const search = searchParams.get('search');
      const location = searchParams.get('location');
      const employment_type = searchParams.get('employment_type');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
      const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

      let sql = `SELECT j.*, jr.name as job_classification_name
                 FROM jobs j
                 LEFT JOIN job_roles jr ON j.job_classification = jr.id
                 WHERE ${WEB_JOB_WHERE}`;
      const params = [];

      if (search) {
        sql += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.company LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      if (location) {
        sql += ' AND j.location LIKE ?';
        params.push(`%${location}%`);
      }
      if (employment_type) {
        sql += ' AND j.employment_type = ?';
        params.push(employment_type);
      }

      sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const countRow = await queryOne(
        env,
        `SELECT COUNT(*) as total FROM jobs j WHERE ${WEB_JOB_WHERE}`
      );

      const rows = await query(env, sql, params);
      const jobs = rows.map((row) => formatCareerJobListItem(row, apiBase));

      return addCorsHeaders(
        jsonResponse({
          jobs,
          pagination: {
            total: countRow?.total ?? jobs.length,
            limit,
            offset,
          },
          meta: {
            api_version: '1',
            listing_type: 'web',
          },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('GET /api/careers/jobs:', error);
      return addCorsHeaders(jsonResponse({ error: 'Server error' }, 500), env, request);
    }
  }

  if (detailMatch && method === 'GET') {
    try {
      const jobId = detailMatch[1];
      const job = await queryOne(
        env,
        `SELECT j.*, jr.name as job_classification_name
         FROM jobs j
         LEFT JOIN job_roles jr ON j.job_classification = jr.id
         WHERE j.id = ? AND ${WEB_JOB_WHERE}`,
        [jobId]
      );

      if (!job) {
        return addCorsHeaders(jsonResponse({ error: 'Job not found' }, 404), env, request);
      }

      return addCorsHeaders(
        jsonResponse({ job: formatCareerJobDetail(job, apiBase) }),
        env,
        request
      );
    } catch (error) {
      console.error('GET /api/careers/jobs/:id:', error);
      return addCorsHeaders(jsonResponse({ error: 'Server error' }, 500), env, request);
    }
  }

  if (applyMatch && method === 'POST') {
    try {
      const jobId = applyMatch[1];
      const job = await queryOne(
        env,
        `SELECT id, title, external_apply_link FROM jobs WHERE id = ? AND ${WEB_JOB_WHERE}`,
        [jobId]
      );

      if (!job) {
        return addCorsHeaders(jsonResponse({ error: 'Job not found or not accepting applications' }, 404), env, request);
      }

      if (job.external_apply_link) {
        return addCorsHeaders(
          jsonResponse({
            redirect: true,
            apply_url: job.external_apply_link,
            message: 'Apply on the external application page.',
          }),
          env,
          request
        );
      }

      const body = await request.json();
      const first_name = String(body.first_name || '').trim();
      const last_name = String(body.last_name || '').trim();
      const email = String(body.email || '').trim();
      const phone = body.phone ? String(body.phone).trim() : null;
      const resume_url = body.resume_url ? String(body.resume_url).trim() : null;
      const linkedin_url = body.linkedin_url ? String(body.linkedin_url).trim() : null;
      const message = body.message ? String(body.message).trim() : null;

      if (!first_name || !last_name || !email) {
        return addCorsHeaders(
          jsonResponse({ error: 'first_name, last_name, and email are required' }, 400),
          env,
          request
        );
      }

      const result = await execute(
        env,
        `INSERT INTO career_applications (job_id, first_name, last_name, email, phone, resume_url, linkedin_url, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [jobId, first_name, last_name, email, phone, resume_url, linkedin_url, message]
      );

      return addCorsHeaders(
        jsonResponse({
          id: result.meta.last_row_id,
          job_id: Number(jobId),
          message: 'Application received. Our team will be in touch.',
        }, 201),
        env,
        request
      );
    } catch (error) {
      console.error('POST /api/careers/jobs/:id/apply:', error);
      return addCorsHeaders(jsonResponse({ error: 'Server error' }, 500), env, request);
    }
  }

  if (path === '/api/careers' && method === 'GET') {
    return addCorsHeaders(
      jsonResponse({
        name: 'GoBunnyy Careers API',
        version: 1,
        endpoints: {
          list_jobs: 'GET /api/careers/jobs',
          job_detail: 'GET /api/careers/jobs/:id',
          apply: 'POST /api/careers/jobs/:id/apply',
        },
      }),
      env,
      request
    );
  }

  return addCorsHeaders(jsonResponse({ error: 'Not found' }, 404), env, request);
}
