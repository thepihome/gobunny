import { fetchJson } from './_http.js';

const ALLOWED_GREENHOUSE_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
]);

function assertGreenhouseUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`greenhouse: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname)) {
    throw new Error(`greenhouse: untrusted hostname "${parsed.hostname}"`);
  }
  return url;
}

function resolveApiUrl(entry) {
  if (entry.api) {
    assertGreenhouseUrl(entry.api);
    return entry.api;
  }
  const url = entry.careers_url || '';
  const match = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (match) return `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs`;
  return null;
}

export default {
  id: 'greenhouse',

  detect(entry) {
    try {
      const apiUrl = resolveApiUrl(entry);
      return apiUrl ? { url: apiUrl } : null;
    } catch {
      return null;
    }
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`greenhouse: cannot derive API URL for ${entry.name}`);
    assertGreenhouseUrl(apiUrl);
    const json = await ctx.fetchJson(apiUrl, { redirect: 'error' });
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    return jobs
      .filter((j) => j.absolute_url)
      .map((j) => ({
        title: j.title || '',
        url: j.absolute_url,
        company: entry.name,
        location: j.location?.name || '',
      }));
  },
};
