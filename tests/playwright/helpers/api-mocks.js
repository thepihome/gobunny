const USERS = {
  admin: {
    id: 1,
    email: 'admin@test.local',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    phone: '',
    is_active: 1,
  },
  consultant: {
    id: 2,
    email: 'consultant@test.local',
    first_name: 'Consult',
    last_name: 'Ant',
    role: 'consultant',
    phone: '',
    is_active: 1,
  },
  candidate: {
    id: 3,
    email: 'candidate@test.local',
    first_name: 'Cand',
    last_name: 'Date',
    role: 'candidate',
    phone: '',
    is_active: 1,
  },
};

const SAMPLE_JOB = {
  id: 1,
  title: 'Senior Engineer',
  company: 'GoBunny Labs',
  location: 'Remote',
  status: 'active',
  employment_type: 'full-time',
  description: 'Build great products',
  created_at: '2026-01-01T00:00:00Z',
};

const SAMPLE_CANDIDATE = {
  id: 10,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@test.local',
  role: 'candidate',
  is_active: 1,
  city: 'Austin',
  state: 'TX',
  current_job_title: 'Engineer',
};

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(data),
  };
}

function matchPath(url, suffix) {
  const path = url.pathname;
  return path === suffix || path.endsWith(suffix);
}

function getMockResponse(request, role) {
  const url = new URL(request.url());
  const method = request.method();
  const user = USERS[role] || USERS.admin;

  if (method === 'OPTIONS') {
    return json({}, 204);
  }

  if (matchPath(url, '/api/auth/me')) {
    return json({ user });
  }

  if (matchPath(url, '/api/kpis/my-kpis')) {
    return json([
      {
        id: 1,
        name: 'Active Jobs',
        description: 'Total active job postings',
        metric_type: 'total_jobs',
        display_order: 0,
        current_value: 12,
        query_config: null,
      },
      {
        id: 2,
        name: 'Filtered Pool',
        description: 'Custom candidate filter',
        metric_type: 'custom_filter',
        display_order: 1,
        current_value: 4,
        query_config: {
          type: 'candidate_filter',
          conditions: [{ field: 'city', value: 'Austin', operator: 'like' }],
        },
      },
    ]);
  }

  if (matchPath(url, '/api/kpis/metric-types')) {
    const types = {
      admin: [
        { value: 'total_jobs', label: 'Total Active Jobs' },
        { value: 'total_users', label: 'Total Users' },
        { value: 'total_candidates', label: 'Total Candidates' },
        { value: 'custom_filter', label: 'Custom Candidate Filter' },
      ],
      consultant: [
        { value: 'total_jobs', label: 'Total Active Jobs' },
        { value: 'assigned_candidates', label: 'Assigned Candidates' },
        { value: 'pending_timesheets', label: 'Pending Timesheets' },
        { value: 'custom_filter', label: 'Custom Candidate Filter' },
      ],
      candidate: [
        { value: 'total_jobs', label: 'Total Active Jobs' },
        { value: 'total_matches', label: 'Total Matches' },
        { value: 'average_match_score', label: 'Average Match Score' },
        { value: 'total_resumes', label: 'Total Resumes' },
      ],
    };
    return json(types[role] || types.admin);
  }

  if (matchPath(url, '/api/dashboard/analytics')) {
    return json({
      summary: {
        active_jobs: 12,
        total_candidates: 48,
        total_users: role === 'admin' ? 55 : undefined,
        my_matches: role === 'candidate' ? 6 : undefined,
      },
      charts: [
        {
          id: 'jobs_by_status',
          title: 'Jobs by Status',
          type: 'bar',
          data: [
            { name: 'active', value: 12, fill: '#2B3D7E' },
            { name: 'closed', value: 3, fill: '#64748b' },
          ],
        },
        {
          id: 'matches_by_status',
          title: 'Match Pipeline',
          type: 'pie',
          data: [
            { name: 'pending', value: 5, fill: '#2B3D7E' },
            { name: 'reviewed', value: 2, fill: '#059669' },
          ],
        },
      ],
    });
  }

  if (matchPath(url, '/api/jobs') && method === 'GET') {
    return json([SAMPLE_JOB]);
  }

  if (matchPath(url, '/api/jobs/1') && method === 'GET') {
    return json(SAMPLE_JOB);
  }

  if (matchPath(url, '/api/matches') && method === 'GET') {
    return json([
      {
        id: 1,
        job_id: 1,
        candidate_id: user.id,
        match_score: 87.5,
        status: 'pending',
        job_title: SAMPLE_JOB.title,
        company: SAMPLE_JOB.company,
      },
    ]);
  }

  if (matchPath(url, '/api/candidates') && method === 'GET') {
    return json([SAMPLE_CANDIDATE]);
  }

  if (matchPath(url, '/api/candidates/assigned') && method === 'GET') {
    return json([SAMPLE_CANDIDATE]);
  }

  if (matchPath(url, '/api/candidates/10') && method === 'GET') {
    return json({ ...SAMPLE_CANDIDATE, phone: '555-0100' });
  }

  if (matchPath(url, '/api/resumes/my-resumes')) {
    return json([
      {
        id: 1,
        file_name: 'resume.pdf',
        uploaded_at: '2026-01-15T00:00:00Z',
        skills: ['JavaScript', 'React'],
      },
    ]);
  }

  if (matchPath(url, '/api/timesheets') && method === 'GET') {
    return json([
      {
        id: 1,
        date: '2026-06-01',
        hours: 8,
        status: 'draft',
        description: 'Client work',
      },
    ]);
  }

  if (matchPath(url, '/api/crm') && method === 'GET') {
    return json([
      {
        id: 1,
        candidate_id: 10,
        interaction_type: 'call',
        interaction_date: '2026-06-01',
        notes: 'Follow-up scheduled',
        status: 'open',
      },
    ]);
  }

  if (matchPath(url, '/api/notifications/seen') && method === 'POST') {
    return json({ success: true });
  }

  if (matchPath(url, '/api/notifications/clear') && method === 'POST') {
    return json({ success: true, cleared: 0 });
  }

  if (matchPath(url, '/api/notifications') && method === 'GET') {
    return json({ notifications: [], count: 0, unreadCount: 0 });
  }

  if (matchPath(url, '/api/users') && method === 'GET') {
    return json(Object.values(USERS));
  }

  if (matchPath(url, '/api/users/1')) {
    return json(USERS.admin);
  }

  if (matchPath(url, '/api/groups')) {
    return json([{ id: 1, name: 'Default', description: 'Default group' }]);
  }

  if (matchPath(url, '/api/permissions')) {
    return json([]);
  }

  if (matchPath(url, '/api/job-roles')) {
    return json([{ id: 1, name: 'Engineering', description: 'Engineering roles' }]);
  }

  if (matchPath(url, '/api/register-candidates')) {
    return json([]);
  }

  if (matchPath(url, '/api/activity-logs')) {
    return json([]);
  }

  if (matchPath(url, '/api/kpis') && method === 'POST') {
    return json({ id: 99, name: 'New KPI', metric_type: 'total_jobs' }, 201);
  }

  if (matchPath(url, '/api/health')) {
    return json({ status: 'OK' });
  }

  return null;
}

module.exports = { USERS, getMockResponse, json };
