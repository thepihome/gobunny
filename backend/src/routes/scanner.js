/**
 * Job portal scanner routes.
 * Public admin routes require JWT + admin role.
 * Internal routes authenticate via X-Scanner-Secret (scanner service only).
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import {
  getScannerConfig,
  saveScannerConfig,
  toPublicScannerConfig,
} from '../utils/scannerSettingsDb.js';

function scannerSecretOk(request, env) {
  const expected = env.SCANNER_SECRET;
  if (!expected) return false;
  const provided = request.headers.get('X-Scanner-Secret');
  return provided && provided === expected;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function adminOnly(user) {
  return authorize('admin')(user);
}

async function proxyScannerRun(env, body = {}) {
  const serviceUrl = (env.SCANNER_SERVICE_URL || 'http://localhost:8790').replace(/\/$/, '');
  const res = await fetch(`${serviceUrl}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.SCANNER_SECRET ? { 'X-Scanner-Secret': env.SCANNER_SECRET } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid scanner response' };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function handleScannerInternal(request, env) {
  if (!scannerSecretOk(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/scanner/internal/config' && method === 'GET') {
    const sources = await query(
      env,
      'SELECT id, name, careers_url, provider, enabled FROM scan_sources WHERE enabled = 1 ORDER BY name'
    );
    const config = await getScannerConfig(env);
    return jsonResponse({
      sources,
      title_filter: config.title_filter,
      location_filter: config.location_filter,
      default_job_status: config.default_job_status,
      schedule_enabled: config.schedule_enabled,
      schedule_cron: config.schedule_cron,
    });
  }

  if (path === '/api/scanner/internal/run-start' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const triggerType = body.trigger_type || 'manual';
    const result = await execute(
      env,
      `INSERT INTO scan_runs (status, trigger_type, started_at) VALUES ('running', ?, datetime('now'))`,
      [triggerType]
    );
    const runId = result.meta.last_row_id;
    return jsonResponse({ run_id: runId });
  }

  if (path === '/api/scanner/internal/ingest' && method === 'POST') {
    const body = await request.json();
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    const defaultStatus = body.default_job_status || 'active';
    let inserted = 0;
    let duplicates = 0;
    let updated = 0;

    for (const job of jobs) {
      const sourceUrl = String(job.url || '').trim();
      const title = String(job.title || '').trim();
      const company = String(job.company || '').trim();
      if (!sourceUrl || !title || !company) continue;

      const existing = await queryOne(
        env,
        'SELECT id FROM jobs WHERE source_url = ? OR external_apply_link = ? LIMIT 1',
        [sourceUrl, sourceUrl]
      );

      if (existing) {
        await execute(
          env,
          `UPDATE jobs SET updated_at = datetime('now'), location = COALESCE(?, location)
           WHERE id = ?`,
          [job.location || null, existing.id]
        );
        duplicates++;
        updated++;
        continue;
      }

      await execute(
        env,
        `INSERT INTO jobs (title, description, company, location, salary_min, salary_max,
         external_apply_link, source_url, source_provider, status, required_skills, preferred_skills)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]')`,
        [
          title,
          job.description || null,
          company,
          job.location || null,
          job.salary?.min ?? null,
          job.salary?.max ?? null,
          sourceUrl,
          sourceUrl,
          job.source_provider || job.source || null,
          defaultStatus,
        ]
      );
      inserted++;
    }

    return jsonResponse({ inserted, duplicates, updated });
  }

  if (path === '/api/scanner/internal/run-complete' && method === 'POST') {
    const body = await request.json();
    const runId = body.run_id;
    if (!runId) return jsonResponse({ error: 'run_id required' }, 400);

    const status = body.status === 'failed' ? 'failed' : 'completed';
    await execute(
      env,
      `UPDATE scan_runs SET status = ?, completed_at = datetime('now'),
       summary = ?, error_message = ? WHERE id = ?`,
      [
        status,
        body.summary ? JSON.stringify(body.summary) : null,
        body.error_message || null,
        runId,
      ]
    );
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export async function handleScanner(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const sourceMatch = path.match(/^\/api\/scanner\/sources\/(\d+)$/);

  if (path === '/api/scanner/status' && method === 'GET') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(
        jsonResponse({ error: authError.error }, authError.status),
        env,
        request
      );
    }

    const lastRun = await queryOne(
      env,
      'SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1'
    );
    const sourceCount = await queryOne(
      env,
      'SELECT COUNT(*) as c FROM scan_sources WHERE enabled = 1'
    );
    const config = toPublicScannerConfig(await getScannerConfig(env));

    let serviceHealth = { reachable: false };
    try {
      const serviceUrl = (env.SCANNER_SERVICE_URL || 'http://localhost:8790').replace(/\/$/, '');
      const res = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        serviceHealth = { reachable: true, ...(await res.json()) };
      }
    } catch {
      serviceHealth = { reachable: false };
    }

    return addCorsHeaders(
      jsonResponse({
        last_run: lastRun,
        enabled_sources: sourceCount?.c || 0,
        config,
        service: serviceHealth,
      }),
      env,
      request
    );
  }

  if (path === '/api/scanner/settings' && method === 'GET') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    const config = toPublicScannerConfig(await getScannerConfig(env));
    return addCorsHeaders(jsonResponse(config), env, request);
  }

  if (path === '/api/scanner/settings' && method === 'PUT') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    try {
      const body = await request.json();
      const partial = {};
      if (typeof body.schedule_enabled === 'boolean') partial.schedule_enabled = body.schedule_enabled;
      if (typeof body.schedule_cron === 'string' && body.schedule_cron.trim()) {
        partial.schedule_cron = body.schedule_cron.trim();
      }
      if (typeof body.default_job_status === 'string') {
        if (['active', 'draft'].includes(body.default_job_status)) {
          partial.default_job_status = body.default_job_status;
        }
      }
      if (body.title_filter && typeof body.title_filter === 'object') {
        partial.title_filter = {
          positive: Array.isArray(body.title_filter.positive)
            ? body.title_filter.positive.map(String)
            : [],
          negative: Array.isArray(body.title_filter.negative)
            ? body.title_filter.negative.map(String)
            : [],
        };
      }
      if (body.location_filter === null) {
        partial.location_filter = null;
      } else if (body.location_filter && typeof body.location_filter === 'object') {
        partial.location_filter = body.location_filter;
      }
      const saved = await saveScannerConfig(env, partial);
      return addCorsHeaders(jsonResponse(toPublicScannerConfig(saved)), env, request);
    } catch (e) {
      return addCorsHeaders(jsonResponse({ error: e.message }, 500), env, request);
    }
  }

  if (path === '/api/scanner/sources' && method === 'GET') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    const sources = await query(env, 'SELECT * FROM scan_sources ORDER BY name');
    return addCorsHeaders(jsonResponse(sources), env, request);
  }

  if (path === '/api/scanner/sources' && method === 'POST') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    try {
      const body = await request.json();
      const { name, careers_url, provider, enabled } = body;
      if (!name?.trim() || !careers_url?.trim()) {
        return addCorsHeaders(jsonResponse({ error: 'name and careers_url required' }, 400), env, request);
      }
      const result = await execute(
        env,
        `INSERT INTO scan_sources (name, careers_url, provider, enabled)
         VALUES (?, ?, ?, ?)`,
        [name.trim(), careers_url.trim(), provider || null, enabled === false ? 0 : 1]
      );
      const source = await queryOne(env, 'SELECT * FROM scan_sources WHERE id = ?', [result.meta.last_row_id]);
      return addCorsHeaders(jsonResponse(source, 201), env, request);
    } catch (e) {
      return addCorsHeaders(jsonResponse({ error: e.message }, 500), env, request);
    }
  }

  if (sourceMatch && method === 'PUT') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    try {
      const id = sourceMatch[1];
      const body = await request.json();
      const existing = await queryOne(env, 'SELECT * FROM scan_sources WHERE id = ?', [id]);
      if (!existing) {
        return addCorsHeaders(jsonResponse({ error: 'Source not found' }, 404), env, request);
      }
      await execute(
        env,
        `UPDATE scan_sources SET name = ?, careers_url = ?, provider = ?, enabled = ?,
         updated_at = datetime('now') WHERE id = ?`,
        [
          body.name?.trim() || existing.name,
          body.careers_url?.trim() || existing.careers_url,
          body.provider !== undefined ? body.provider : existing.provider,
          body.enabled === false ? 0 : body.enabled === true ? 1 : existing.enabled,
          id,
        ]
      );
      const source = await queryOne(env, 'SELECT * FROM scan_sources WHERE id = ?', [id]);
      return addCorsHeaders(jsonResponse(source), env, request);
    } catch (e) {
      return addCorsHeaders(jsonResponse({ error: e.message }, 500), env, request);
    }
  }

  if (sourceMatch && method === 'DELETE') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    const id = sourceMatch[1];
    await execute(env, 'DELETE FROM scan_sources WHERE id = ?', [id]);
    return addCorsHeaders(jsonResponse({ ok: true }), env, request);
  }

  if (path === '/api/scanner/runs' && method === 'GET') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const runs = await query(
      env,
      'SELECT * FROM scan_runs ORDER BY id DESC LIMIT ?',
      [limit]
    );
    const parsed = runs.map((r) => ({
      ...r,
      summary: r.summary ? JSON.parse(r.summary) : null,
    }));
    return addCorsHeaders(jsonResponse(parsed), env, request);
  }

  if (path === '/api/scanner/run' && method === 'POST') {
    const authError = adminOnly(user);
    if (authError) {
      return addCorsHeaders(jsonResponse({ error: authError.error }, authError.status), env, request);
    }
    try {
      const body = await request.json().catch(() => ({}));
      const result = await proxyScannerRun(env, { trigger_type: 'manual', ...body });
      return addCorsHeaders(jsonResponse(result.data, result.status), env, request);
    } catch (e) {
      return addCorsHeaders(
        jsonResponse(
          {
            error: 'Scanner service unreachable',
            message: e.message,
            hint: 'Start the scanner with: cd scanner && npm start',
          },
          503
        ),
        env,
        request
      );
    }
  }

  return addCorsHeaders(jsonResponse({ error: 'Not found' }, 404), env, request);
}
