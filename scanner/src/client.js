/**
 * HTTP client for GoBunnyy scanner internal API.
 */

export function createGobunnyClient({ apiUrl, secret }) {
  const base = apiUrl.replace(/\/$/, '');

  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Scanner-Secret': secret,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    getConfig: () => request('/scanner/internal/config'),
    runStart: (triggerType) =>
      request('/scanner/internal/run-start', {
        method: 'POST',
        body: { trigger_type: triggerType },
      }),
    ingest: (jobs, defaultJobStatus) =>
      request('/scanner/internal/ingest', {
        method: 'POST',
        body: { jobs, default_job_status: defaultJobStatus },
      }),
    runComplete: (payload) =>
      request('/scanner/internal/run-complete', {
        method: 'POST',
        body: payload,
      }),
  };
}
