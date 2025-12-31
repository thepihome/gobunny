-- Migration: Remove secondary_job_title column from candidate_profiles (D1/SQLite)
-- Note: SQLite doesn't support DROP COLUMN directly, so we'll need to recreate the table
-- This is a destructive operation - backup your data first!

-- Step 1: Create backup of data
CREATE TABLE IF NOT EXISTS candidate_profiles_backup AS SELECT * FROM candidate_profiles;

-- Step 2: Create new table without secondary_job_title
CREATE TABLE candidate_profiles_new (
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
  job_classification INTEGER REFERENCES job_roles(id),
  current_job_title TEXT,
  current_company TEXT,
  years_of_experience INTEGER,
  availability TEXT,
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  work_authorization TEXT,
  willing_to_relocate INTEGER DEFAULT 0,
  preferred_locations TEXT,
  summary TEXT,
  additional_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Step 3: Copy data (excluding secondary_job_title)
INSERT INTO candidate_profiles_new 
SELECT 
  id, user_id, date_of_birth, address, city, state, country, zip_code,
  linkedin_url, portfolio_url, github_url, job_classification, current_job_title,
  current_company, years_of_experience, availability,
  expected_salary_min, expected_salary_max, work_authorization,
  willing_to_relocate, preferred_locations, summary, additional_notes,
  created_at, updated_at
FROM candidate_profiles;

-- Step 4: Drop old table
DROP TABLE candidate_profiles;

-- Step 5: Rename new table
ALTER TABLE candidate_profiles_new RENAME TO candidate_profiles;

-- Step 6: Verify (optional)
-- SELECT COUNT(*) FROM candidate_profiles;

-- Note: If something goes wrong, restore from backup:
-- DROP TABLE candidate_profiles;
-- ALTER TABLE candidate_profiles_backup RENAME TO candidate_profiles;

