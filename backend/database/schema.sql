-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('candidate', 'consultant', 'admin')),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Candidate profiles table (extended candidate information)
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  date_of_birth DATE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  zip_code VARCHAR(20),
  linkedin_url VARCHAR(500),
  portfolio_url VARCHAR(500),
  github_url VARCHAR(500),
  current_job_title VARCHAR(255),
  current_company VARCHAR(255),
  years_of_experience INTEGER,
  availability VARCHAR(50),
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  work_authorization VARCHAR(100),
  willing_to_relocate BOOLEAN DEFAULT false,
  preferred_locations TEXT[],
  summary TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User groups (many-to-many)
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  salary_min INTEGER,
  salary_max INTEGER,
  employment_type VARCHAR(50),
  required_skills TEXT[],
  preferred_skills TEXT[],
  experience_level VARCHAR(50),
  external_apply_link VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft', 'deleted')),
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  content_text TEXT,
  skills TEXT[],
  experience_years INTEGER,
  education TEXT,
  summary TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job matches (resume to job matching)
CREATE TABLE IF NOT EXISTS job_matches (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2) NOT NULL,
  skills_match INTEGER,
  experience_match INTEGER,
  education_match INTEGER,
  matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected')),
  notes TEXT,
  UNIQUE(job_id, resume_id)
);

-- Consultant assignments
CREATE TABLE IF NOT EXISTS consultant_assignments (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  UNIQUE(consultant_id, candidate_id)
);

-- Timesheets table
CREATE TABLE IF NOT EXISTS timesheets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM contacts/interactions
CREATE TABLE IF NOT EXISTS crm_contacts (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  interaction_date TIMESTAMP NOT NULL,
  notes TEXT,
  follow_up_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPIs table
CREATE TABLE IF NOT EXISTS kpis (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric_type VARCHAR(50) NOT NULL,
  query_config JSONB,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPI values (for storing calculated KPI data)
CREATE TABLE IF NOT EXISTS kpi_values (
  id SERIAL PRIMARY KEY,
  kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
  value DECIMAL(10,2),
  label VARCHAR(255),
  date_recorded DATE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource_type VARCHAR(50) NOT NULL, -- 'tab', 'user', 'job', 'candidate', etc.
  action VARCHAR(50) NOT NULL -- 'view', 'create', 'edit', 'delete'
);

-- Role permissions (default permissions for roles)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

-- User-specific permissions (override role permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true, -- true = granted, false = denied
  UNIQUE(user_id, permission_id)
);

-- Group permissions
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  UNIQUE(group_id, permission_id)
);

-- Insert default permissions
INSERT INTO permissions (name, description, resource_type, action) VALUES
  -- Tab visibility permissions
  ('tab_dashboard', 'Access Dashboard tab', 'tab', 'view'),
  ('tab_jobs', 'Access Jobs tab', 'tab', 'view'),
  ('tab_resumes', 'Access Resumes tab', 'tab', 'view'),
  ('tab_matches', 'Access Matches tab', 'tab', 'view'),
  ('tab_candidates', 'Access Candidates tab', 'tab', 'view'),
  ('tab_timesheets', 'Access Timesheets tab', 'tab', 'view'),
  ('tab_crm', 'Access CRM tab', 'tab', 'view'),
  ('tab_settings', 'Access Settings tab', 'tab', 'view'),
  -- Job permissions
  ('job_view', 'View job listings', 'job', 'view'),
  ('job_create', 'Create new job postings', 'job', 'create'),
  ('job_edit', 'Edit job postings', 'job', 'edit'),
  ('job_delete', 'Delete job postings', 'job', 'delete'),
  -- User permissions
  ('user_view', 'View users', 'user', 'view'),
  ('user_create', 'Create users', 'user', 'create'),
  ('user_edit', 'Edit users', 'user', 'edit'),
  ('user_delete', 'Delete users', 'user', 'delete'),
  -- Candidate permissions
  ('candidate_view', 'View candidate profiles', 'candidate', 'view'),
  ('candidate_create', 'Create candidate profiles', 'candidate', 'create'),
  ('candidate_edit', 'Edit candidate profiles', 'candidate', 'edit'),
  ('candidate_delete', 'Delete candidate profiles', 'candidate', 'delete'),
  ('candidate_assign', 'Assign candidates to consultants', 'candidate', 'assign'),
  -- Other permissions
  ('timesheet_view', 'View timesheets', 'timesheet', 'view'),
  ('timesheet_create', 'Create timesheets', 'timesheet', 'create'),
  ('timesheet_approve', 'Approve timesheets', 'timesheet', 'approve'),
  ('group_manage', 'Manage user groups', 'group', 'manage'),
  ('kpi_manage', 'Manage KPIs', 'kpi', 'manage'),
  ('view_all_data', 'View all data across the platform', 'system', 'view')
ON CONFLICT (name) DO NOTHING;

-- Insert default role permissions
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'consultant', id FROM permissions WHERE name IN (
  'tab_dashboard', 'tab_jobs', 'tab_matches', 'tab_candidates', 'tab_timesheets', 'tab_crm', 'tab_settings',
  'job_view', 'job_create', 'job_edit', 'job_delete',
  'candidate_view', 'candidate_edit',
  'timesheet_view', 'timesheet_create',
  'kpi_manage'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'candidate', id FROM permissions WHERE name IN (
  'tab_dashboard', 'tab_jobs', 'tab_resumes', 'tab_matches', 'tab_settings',
  'job_view',
  'kpi_manage'
)
ON CONFLICT DO NOTHING;

-- Activity logs table (tracks all dashboard activities)
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100) NOT NULL, -- 'candidate_profile', 'user', 'job', 'resume', etc.
  entity_id INTEGER NOT NULL, -- ID of the entity being modified
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view', etc.
  field_name VARCHAR(100), -- Name of the field being changed (for updates)
  old_value TEXT, -- Previous value (for updates)
  new_value TEXT, -- New value (for updates)
  description TEXT, -- Human-readable description of the change
  metadata JSONB, -- Additional context
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
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

