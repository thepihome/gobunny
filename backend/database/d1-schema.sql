-- D1 (SQLite) Schema for Cloudflare Workers
-- Converted from PostgreSQL schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'consultant', 'admin')),
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1
);

-- Candidate profiles table
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  date_of_birth TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zip_code TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  current_job_title TEXT, -- Kept for backward compatibility, use job_classification instead
  job_classification INTEGER REFERENCES job_roles(id),
  secondary_job_title TEXT,
  current_company TEXT,
  years_of_experience INTEGER,
  availability TEXT,
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  work_authorization TEXT,
  willing_to_relocate INTEGER DEFAULT 0,
  preferred_locations TEXT, -- JSON array stored as text
  summary TEXT,
  additional_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- User groups (many-to-many)
CREATE TABLE IF NOT EXISTS user_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, group_id)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  job_classification INTEGER REFERENCES job_roles(id),
  description TEXT,
  company TEXT NOT NULL,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  employment_type TEXT,
  required_skills TEXT, -- JSON array stored as text
  preferred_skills TEXT, -- JSON array stored as text
  experience_level TEXT,
  external_apply_link TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft', 'deleted')),
  posted_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT, -- R2 object key
  file_name TEXT,
  file_size INTEGER,
  content_text TEXT,
  skills TEXT, -- JSON array stored as text
  experience_years INTEGER,
  education TEXT,
  summary TEXT,
  uploaded_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Job matches
CREATE TABLE IF NOT EXISTS job_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_score REAL NOT NULL,
  skills_match INTEGER,
  experience_match INTEGER,
  education_match INTEGER,
  matched_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected')),
  notes TEXT,
  UNIQUE(job_id, resume_id)
);

-- Consultant assignments
CREATE TABLE IF NOT EXISTS consultant_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active',
  UNIQUE(consultant_id, candidate_id)
);

-- Timesheets table
CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TEXT,
  approved_at TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- CRM contacts/interactions
CREATE TABLE IF NOT EXISTS crm_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  interaction_date TEXT NOT NULL,
  notes TEXT,
  follow_up_date TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- KPIs table
CREATE TABLE IF NOT EXISTS kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL,
  query_config TEXT, -- JSON stored as text
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- KPI values
CREATE TABLE IF NOT EXISTS kpi_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
  value REAL,
  label TEXT,
  date_recorded TEXT,
  metadata TEXT, -- JSON stored as text
  created_at TEXT DEFAULT (datetime('now'))
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL,
  action TEXT NOT NULL
);

-- Role permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

-- User-specific permissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted INTEGER DEFAULT 1,
  UNIQUE(user_id, permission_id)
);

-- Group permissions
CREATE TABLE IF NOT EXISTS group_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted INTEGER DEFAULT 1,
  UNIQUE(group_id, permission_id)
);

-- Job roles table (metadata for standard job titles)
CREATE TABLE IF NOT EXISTS job_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Activity logs table (tracks all dashboard activities)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'candidate_profile', 'user', 'job', 'resume', etc.
  entity_id INTEGER NOT NULL, -- ID of the entity being modified
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', etc.
  field_name TEXT, -- Name of the field being changed (for updates)
  old_value TEXT, -- Previous value (for updates)
  new_value TEXT, -- New value (for updates)
  description TEXT, -- Human-readable description of the change
  metadata TEXT, -- JSON stored as text for additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_matches_candidate ON job_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_consultant_assignments_consultant ON consultant_assignments(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_assignments_candidate ON consultant_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);
CREATE INDEX IF NOT EXISTS idx_kpis_user ON kpis(user_id);

