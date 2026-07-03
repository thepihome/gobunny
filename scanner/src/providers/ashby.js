const ASHBY_TIMEOUT_MS = 30_000;
const ASHBY_RETRIES = 2;

const INTERVAL_MULTIPLIERS = {
  '1 HOUR': 2080,
  '1 DAY': 260,
  '1 WEEK': 52,
  '2 WEEK': 26,
  '0.5 MONTH': 24,
  '1 MONTH': 12,
  '2 MONTH': 6,
  '3 MONTH': 4,
  '6 MONTH': 2,
  '1 YEAR': 1,
};

export function parseCompensation(job) {
  const comp = job?.compensation;
  if (!comp) return null;

  const interval = comp.interval || '1 YEAR';
  const multiplier = INTERVAL_MULTIPLIERS[interval];
  if (!multiplier) return null;

  const normalizeNum = (v) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const minValue = normalizeNum(comp.minValue);
  const maxValue = normalizeNum(comp.maxValue);
  const currency = typeof comp.currency === 'string' ? comp.currency.trim() : '';

  if (minValue == null && maxValue == null) return null;

  const min = minValue != null ? minValue * multiplier : null;
  const max = maxValue != null ? maxValue * multiplier : null;
  if (min == null && max == null) return null;

  const resolvedMin = min ?? max;
  const resolvedMax = max ?? min;
  return {
    min: Math.min(resolvedMin, resolvedMax),
    max: Math.max(resolvedMin, resolvedMax),
    currency: currency.toUpperCase(),
  };
}

function resolveApiUrl(entry) {
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.ashbyhq.com/posting-api/job-board/${match[1]}?includeCompensation=true`;
}

function formatLocation(j) {
  const parts = [];
  if (typeof j.location === 'string' && j.location.trim()) parts.push(j.location.trim());
  if (Array.isArray(j.secondaryLocations)) {
    for (const s of j.secondaryLocations) {
      if (!s || typeof s !== 'object') continue;
      if (typeof s.location === 'string' && s.location.trim()) parts.push(s.location.trim());
    }
  }
  return [...new Set(parts)].join(' · ');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  id: 'ashby',

  detect(entry) {
    const apiUrl = resolveApiUrl(entry);
    return apiUrl ? { url: apiUrl } : null;
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`ashby: cannot derive API URL for ${entry.name}`);
    let lastErr;
    for (let attempt = 0; attempt <= ASHBY_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
      }
      try {
        const json = await ctx.fetchJson(apiUrl, { timeoutMs: ASHBY_TIMEOUT_MS });
        const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
        return jobs.map((j) => ({
          title: j.title || '',
          url: j.jobUrl || '',
          company: entry.name,
          location: formatLocation(j),
          salary: parseCompensation(j),
        }));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
};
