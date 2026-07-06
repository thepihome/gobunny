/**
 * Job listing visibility helpers.
 * - internal: visible in GoDash app only
 * - web: published on public career site API
 * - external: portal-scanned jobs (GoDash tracking, apply off-site)
 */

export const LISTING_TYPES = ['internal', 'web', 'external'];

export function normalizeListingType(value, fallback = 'internal') {
  const v = String(value || '').toLowerCase().trim();
  return LISTING_TYPES.includes(v) ? v : fallback;
}

export function parseJobJsonFields(job) {
  if (!job) return job;
  const parsed = { ...job };
  for (const field of ['required_skills', 'preferred_skills']) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        parsed[field] = [];
      }
    }
  }
  parsed.listing_type = normalizeListingType(parsed.listing_type, 'internal');
  return parsed;
}

export function formatSalaryDisplay(job) {
  const min = job.salary_min;
  const max = job.salary_max;
  if (min != null && max != null) {
    return `$${Number(min).toLocaleString('en-US')} – $${Number(max).toLocaleString('en-US')}`;
  }
  if (min != null) return `From $${Number(min).toLocaleString('en-US')}`;
  if (max != null) return `Up to $${Number(max).toLocaleString('en-US')}`;
  return null;
}

function summaryFromDescription(description, maxLen = 220) {
  if (!description || typeof description !== 'string') return null;
  const flat = description.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen - 1)}…`;
}

export function buildCareerApiBase(request, env) {
  const fromEnv = env.CAREERS_API_BASE_URL || env.PUBLIC_API_BASE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/careers`;
}

export function formatCareerJobListItem(job, apiBase) {
  const parsed = parseJobJsonFields(job);
  const applyPath = `${apiBase}/jobs/${parsed.id}/apply`;
  return {
    id: parsed.id,
    title: parsed.title,
    company: parsed.company,
    location: parsed.location || null,
    employment_type: parsed.employment_type || null,
    experience_level: parsed.experience_level || null,
    salary: {
      min: parsed.salary_min ?? null,
      max: parsed.salary_max ?? null,
      currency: 'USD',
      display: formatSalaryDisplay(parsed),
    },
    summary: summaryFromDescription(parsed.description),
    required_skills: parsed.required_skills || [],
    posted_at: parsed.created_at,
    updated_at: parsed.updated_at,
    detail_url: `${apiBase}/jobs/${parsed.id}`,
    apply_url: applyPath,
    external_apply_link: parsed.external_apply_link || null,
    apply_mode: parsed.external_apply_link ? 'external' : 'form',
  };
}

export function formatCareerJobDetail(job, apiBase) {
  const list = formatCareerJobListItem(job, apiBase);
  const parsed = parseJobJsonFields(job);
  return {
    ...list,
    description: parsed.description || '',
    preferred_skills: parsed.preferred_skills || [],
    job_classification_name: parsed.job_classification_name || null,
  };
}
