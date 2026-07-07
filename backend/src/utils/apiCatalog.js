/**
 * API endpoint catalog — single source for Settings / integration docs.
 * Paths are absolute from the worker origin (include /api prefix).
 */

const CATEGORIES = [
  { id: 'health', label: 'Health' },
  { id: 'auth', label: 'Authentication' },
  { id: 'careers', label: 'Careers API (public)' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'matches', label: 'Job matches' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'crm', label: 'CRM' },
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'users', label: 'Users' },
  { id: 'groups', label: 'Groups' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'kpis', label: 'KPIs' },
  { id: 'job-roles', label: 'Job roles' },
  { id: 'activity-logs', label: 'Activity logs' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'candidate-profiles', label: 'Candidate profiles' },
  { id: 'register-candidates', label: 'Register candidates' },
  { id: 'settings', label: 'App settings' },
  { id: 'scanner', label: 'Job scanner' },
];

/** @typedef {'public'|'jwt'|'admin'|'staff'|'internal'} AuthType */

/**
 * @param {string} method
 * @param {string} path
 * @param {string} description
 * @param {{ auth?: AuthType, category: string, notes?: string }} meta
 */
function ep(method, path, description, { auth = 'jwt', category, notes } = {}) {
  return { method: method.toUpperCase(), path, description, auth, category, notes: notes || null };
}

export const API_CATALOG = [
  ep('GET', '/api', 'API root — basic status', { auth: 'public', category: 'health' }),
  ep('GET', '/api/health', 'Worker health check', { auth: 'public', category: 'health' }),
  ep('GET', '/api/health/db', 'Database connectivity (table list, user count)', { auth: 'admin', category: 'health' }),
  ep('GET', '/api/endpoints', 'This endpoint catalog with resolved base URLs', { auth: 'jwt', category: 'health' }),

  ep('POST', '/api/auth/google', 'Sign in with Google ID token', { auth: 'public', category: 'auth' }),
  ep('POST', '/api/auth/login', 'Email/password login (legacy)', { auth: 'public', category: 'auth' }),
  ep('POST', '/api/auth/register', 'Register a new account', { auth: 'public', category: 'auth' }),
  ep('GET', '/api/auth/me', 'Current user from JWT', { auth: 'jwt', category: 'auth' }),

  ep('GET', '/api/careers', 'Careers API discovery document', { auth: 'public', category: 'careers' }),
  ep('GET', '/api/careers/jobs', 'List web-published jobs', { auth: 'public', category: 'careers', notes: 'Query: search, location, employment_type, limit, offset' }),
  ep('GET', '/api/careers/jobs/:id', 'Job detail for career site', { auth: 'public', category: 'careers' }),
  ep('POST', '/api/careers/jobs/:id/apply', 'Submit career site application', { auth: 'public', category: 'careers' }),

  ep('GET', '/api/jobs', 'List jobs (role-filtered)', { auth: 'jwt', category: 'jobs', notes: 'Query: status, search, location, employment_type, listing_type' }),
  ep('GET', '/api/jobs/opportunities', 'Active jobs for candidates', { auth: 'jwt', category: 'jobs' }),
  ep('POST', '/api/jobs', 'Create job', { auth: 'staff', category: 'jobs' }),
  ep('GET', '/api/jobs/:id', 'Job detail', { auth: 'jwt', category: 'jobs' }),
  ep('PUT', '/api/jobs/:id', 'Update job', { auth: 'staff', category: 'jobs' }),
  ep('PATCH', '/api/jobs/:id/listing-type', 'Set listing visibility (internal / web / external)', { auth: 'staff', category: 'jobs' }),
  ep('DELETE', '/api/jobs/:id', 'Delete job', { auth: 'staff', category: 'jobs' }),

  ep('GET', '/api/resumes', 'List resumes (staff)', { auth: 'staff', category: 'resumes' }),
  ep('GET', '/api/resumes/my-resumes', 'Current user resumes', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/upload', 'Upload resume file', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/create-text', 'Create text resume', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/upload-for-candidate/:userId', 'Upload resume for candidate', { auth: 'admin', category: 'resumes' }),
  ep('GET', '/api/resumes/:id', 'Resume detail', { auth: 'jwt', category: 'resumes' }),
  ep('PUT', '/api/resumes/:id', 'Update resume', { auth: 'jwt', category: 'resumes' }),
  ep('DELETE', '/api/resumes/:id', 'Delete resume', { auth: 'jwt', category: 'resumes' }),
  ep('GET', '/api/resumes/:id/download', 'Download resume file', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/:id/analyze', 'AI resume analysis', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/:id/score', 'Score resume against job', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/:id/suggestions', 'AI resume suggestions', { auth: 'jwt', category: 'resumes' }),
  ep('POST', '/api/resumes/:id/parse', 'Parse resume to structured content', { auth: 'jwt', category: 'resumes' }),

  ep('POST', '/api/matches/match', 'Match resume to job', { auth: 'jwt', category: 'matches' }),
  ep('GET', '/api/matches/candidate/:id', 'Matches for candidate', { auth: 'jwt', category: 'matches' }),
  ep('GET', '/api/matches/job/:id', 'Matches for job', { auth: 'jwt', category: 'matches' }),
  ep('POST', '/api/matches/auto-match/:jobId', 'Auto-match candidates to job', { auth: 'staff', category: 'matches' }),
  ep('POST', '/api/matches/ai-recompute-job/:jobId', 'Recompute AI scores for job', { auth: 'staff', category: 'matches' }),
  ep('POST', '/api/matches/ai-recompute-candidate/:candidateId', 'Recompute AI scores for candidate', { auth: 'staff', category: 'matches' }),

  ep('GET', '/api/candidates', 'List candidates', { auth: 'staff', category: 'candidates' }),
  ep('GET', '/api/candidates/assigned', 'Consultant assigned candidates', { auth: 'staff', category: 'candidates' }),
  ep('GET', '/api/candidates/:id', 'Candidate detail', { auth: 'staff', category: 'candidates' }),
  ep('POST', '/api/candidates/:id/assign', 'Assign consultant to candidate', { auth: 'staff', category: 'candidates' }),
  ep('DELETE', '/api/candidates/:id/assign/:consultantId', 'Remove assignment', { auth: 'staff', category: 'candidates' }),
  ep('PUT', '/api/candidates/:id/status', 'Update candidate status', { auth: 'staff', category: 'candidates' }),

  ep('GET', '/api/crm', 'List CRM interactions', { auth: 'staff', category: 'crm' }),
  ep('POST', '/api/crm', 'Create CRM interaction', { auth: 'staff', category: 'crm' }),
  ep('GET', '/api/crm/candidate/:id', 'CRM timeline for candidate', { auth: 'staff', category: 'crm' }),
  ep('PUT', '/api/crm/:id', 'Update interaction', { auth: 'staff', category: 'crm' }),
  ep('DELETE', '/api/crm/:id', 'Delete interaction', { auth: 'staff', category: 'crm' }),

  ep('GET', '/api/timesheets', 'List timesheets', { auth: 'jwt', category: 'timesheets' }),
  ep('POST', '/api/timesheets', 'Create timesheet', { auth: 'jwt', category: 'timesheets' }),
  ep('GET', '/api/timesheets/:id', 'Timesheet detail', { auth: 'jwt', category: 'timesheets' }),
  ep('PUT', '/api/timesheets/:id', 'Update timesheet', { auth: 'jwt', category: 'timesheets' }),
  ep('DELETE', '/api/timesheets/:id', 'Delete timesheet', { auth: 'jwt', category: 'timesheets' }),
  ep('POST', '/api/timesheets/:id/submit', 'Submit for approval', { auth: 'jwt', category: 'timesheets' }),
  ep('POST', '/api/timesheets/:id/approve', 'Approve or reject timesheet', { auth: 'staff', category: 'timesheets' }),

  ep('GET', '/api/users', 'List users', { auth: 'admin', category: 'users' }),
  ep('POST', '/api/users', 'Create user', { auth: 'admin', category: 'users' }),
  ep('GET', '/api/users/:id', 'User detail', { auth: 'jwt', category: 'users' }),
  ep('PUT', '/api/users/:id', 'Update user', { auth: 'jwt', category: 'users' }),
  ep('DELETE', '/api/users/:id', 'Delete user', { auth: 'admin', category: 'users' }),
  ep('PUT', '/api/users/:id/password', 'Change password', { auth: 'jwt', category: 'users' }),
  ep('GET', '/api/users/:id/activity', 'User activity log', { auth: 'jwt', category: 'users' }),

  ep('GET', '/api/groups', 'List groups', { auth: 'admin', category: 'groups' }),
  ep('POST', '/api/groups', 'Create group', { auth: 'admin', category: 'groups' }),
  ep('GET', '/api/groups/:id', 'Group detail with members', { auth: 'admin', category: 'groups' }),
  ep('PUT', '/api/groups/:id', 'Update group', { auth: 'admin', category: 'groups' }),
  ep('DELETE', '/api/groups/:id', 'Delete group', { auth: 'admin', category: 'groups' }),
  ep('POST', '/api/groups/:id/users/:userId', 'Add user to group', { auth: 'admin', category: 'groups' }),
  ep('DELETE', '/api/groups/:id/users/:userId', 'Remove user from group', { auth: 'admin', category: 'groups' }),

  ep('GET', '/api/permissions', 'Permission catalog', { auth: 'admin', category: 'permissions' }),
  ep('GET', '/api/permissions/role/:role', 'Role default permissions', { auth: 'admin', category: 'permissions' }),
  ep('POST', '/api/permissions/role/:role', 'Update role defaults', { auth: 'admin', category: 'permissions' }),
  ep('GET', '/api/permissions/user/:id', 'Effective user permissions', { auth: 'admin', category: 'permissions' }),
  ep('POST', '/api/permissions/user/:id', 'Set user permissions', { auth: 'admin', category: 'permissions' }),
  ep('GET', '/api/permissions/group/:id', 'Group permissions', { auth: 'admin', category: 'permissions' }),
  ep('POST', '/api/permissions/group/:id', 'Set group permissions', { auth: 'admin', category: 'permissions' }),

  ep('GET', '/api/dashboard/analytics', 'Dashboard analytics', { auth: 'jwt', category: 'dashboard' }),

  ep('GET', '/api/kpis/metric-types', 'KPI metric types for role', { auth: 'jwt', category: 'kpis' }),
  ep('GET', '/api/kpis/my-kpis', 'Current user KPIs with values', { auth: 'jwt', category: 'kpis' }),
  ep('POST', '/api/kpis', 'Create KPI', { auth: 'jwt', category: 'kpis' }),
  ep('PUT', '/api/kpis/:id', 'Update KPI', { auth: 'jwt', category: 'kpis' }),
  ep('DELETE', '/api/kpis/:id', 'Delete KPI', { auth: 'jwt', category: 'kpis' }),

  ep('GET', '/api/job-roles', 'List job classifications', { auth: 'jwt', category: 'job-roles' }),
  ep('POST', '/api/job-roles', 'Create job classification', { auth: 'admin', category: 'job-roles' }),

  ep('GET', '/api/activity-logs', 'Activity log feed', { auth: 'staff', category: 'activity-logs' }),

  ep('GET', '/api/notifications', 'Notification feed', { auth: 'jwt', category: 'notifications' }),
  ep('POST', '/api/notifications/seen', 'Mark notifications seen', { auth: 'jwt', category: 'notifications' }),
  ep('POST', '/api/notifications/clear', 'Clear notifications', { auth: 'jwt', category: 'notifications' }),

  ep('GET', '/api/candidate-profiles/:id', 'Profile by profile id', { auth: 'jwt', category: 'candidate-profiles' }),
  ep('GET', '/api/candidate-profiles/user/:userId', 'Profile by user id', { auth: 'jwt', category: 'candidate-profiles' }),
  ep('POST', '/api/candidate-profiles', 'Create candidate profile', { auth: 'jwt', category: 'candidate-profiles' }),
  ep('PUT', '/api/candidate-profiles', 'Update candidate profile', { auth: 'jwt', category: 'candidate-profiles' }),

  ep('GET', '/api/register-candidates', 'Registered candidates list', { auth: 'staff', category: 'register-candidates' }),
  ep('GET', '/api/register-candidates/:id', 'Registered candidate detail', { auth: 'staff', category: 'register-candidates' }),

  ep('GET', '/api/settings/ai-matching', 'AI matching configuration', { auth: 'admin', category: 'settings' }),
  ep('PUT', '/api/settings/ai-matching', 'Update AI matching configuration', { auth: 'admin', category: 'settings' }),
  ep('GET', '/api/settings/email', 'Email / SMTP settings', { auth: 'admin', category: 'settings' }),
  ep('PUT', '/api/settings/email', 'Update email settings', { auth: 'admin', category: 'settings' }),
  ep('POST', '/api/settings/email/test', 'Send test email', { auth: 'admin', category: 'settings' }),
  ep('POST', '/api/settings/email/templates/:templateKey/reset', 'Reset email template to default', { auth: 'admin', category: 'settings' }),

  ep('GET', '/api/scanner/status', 'Scanner service status', { auth: 'admin', category: 'scanner' }),
  ep('GET', '/api/scanner/settings', 'Scanner settings', { auth: 'admin', category: 'scanner' }),
  ep('PUT', '/api/scanner/settings', 'Update scanner settings', { auth: 'admin', category: 'scanner' }),
  ep('GET', '/api/scanner/sources', 'List scan sources', { auth: 'admin', category: 'scanner' }),
  ep('POST', '/api/scanner/sources', 'Add scan source', { auth: 'admin', category: 'scanner' }),
  ep('PUT', '/api/scanner/sources/:id', 'Update scan source', { auth: 'admin', category: 'scanner' }),
  ep('DELETE', '/api/scanner/sources/:id', 'Delete scan source', { auth: 'admin', category: 'scanner' }),
  ep('GET', '/api/scanner/runs', 'Scan run history', { auth: 'admin', category: 'scanner', notes: 'Query: limit' }),
  ep('POST', '/api/scanner/run', 'Trigger manual scan', { auth: 'admin', category: 'scanner' }),
  ep('GET', '/api/scanner/internal/config', 'Scanner worker config poll', { auth: 'internal', category: 'scanner', notes: 'Header: X-Scanner-Secret' }),
  ep('POST', '/api/scanner/internal/run-start', 'Scanner run start hook', { auth: 'internal', category: 'scanner' }),
  ep('POST', '/api/scanner/internal/ingest', 'Scanner job ingest', { auth: 'internal', category: 'scanner' }),
  ep('POST', '/api/scanner/internal/run-complete', 'Scanner run complete hook', { auth: 'internal', category: 'scanner' }),
];

export const AUTH_LABELS = {
  public: 'Public',
  jwt: 'Bearer JWT',
  admin: 'Admin',
  staff: 'Consultant+',
  internal: 'Scanner secret',
};

export function buildApiOrigin(request, env) {
  const fromEnv = env.PUBLIC_API_BASE_URL || env.CAREERS_API_BASE_URL;
  if (fromEnv) {
    return String(fromEnv).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function buildEndpointsPayload(request, env) {
  const apiOrigin = buildApiOrigin(request, env);
  const apiBase = `${apiOrigin}/api`;
  const requestOrigin = request.headers.get('Origin');

  const byCategory = new Map();
  for (const cat of CATEGORIES) {
    byCategory.set(cat.id, { ...cat, endpoints: [] });
  }

  for (const entry of API_CATALOG) {
    const group = byCategory.get(entry.category);
    if (!group) continue;
    group.endpoints.push({
      ...entry,
      url: `${apiOrigin}${entry.path}`,
      auth_label: AUTH_LABELS[entry.auth] || entry.auth,
    });
  }

  const groups = CATEGORIES.map((cat) => byCategory.get(cat.id)).filter((g) => g.endpoints.length > 0);

  return {
    api_origin: apiOrigin,
    api_base: apiBase,
    frontend_origin: requestOrigin || null,
    auth_header: 'Authorization: Bearer <jwt>',
    groups,
    generated_at: new Date().toISOString(),
  };
}
