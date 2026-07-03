const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; gobunnyy-scanner/1.0)';

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, method = 'GET', body = null, redirect = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    });
    if (!res.ok) {
      const responseText = await res.text().catch(() => '');
      const err = new Error(responseText ? `HTTP ${res.status}: ${responseText.slice(0, 200)}` : `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return res.json();
}

export function makeHttpCtx() {
  return { fetchJson };
}
