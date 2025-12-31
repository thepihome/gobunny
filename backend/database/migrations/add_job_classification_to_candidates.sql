-- Migration: Add job_classification (ID) to candidate_profiles table
-- This changes current_job_title from TEXT to use job_roles ID reference

-- For D1 (SQLite)
-- Step 1: Add new column
ALTER TABLE candidate_profiles ADD COLUMN job_classification INTEGER REFERENCES job_roles(id);

-- Step 2: Migrate existing data from current_job_title (name) to job_classification (ID)
-- This will match candidates' current_job_title with job_roles.name and set the ID
UPDATE candidate_profiles 
SET job_classification = (
  SELECT jr.id 
  FROM job_roles jr 
  WHERE TRIM(LOWER(jr.name)) = TRIM(LOWER(candidate_profiles.current_job_title))
  AND jr.is_active = 1
  LIMIT 1
)
WHERE current_job_title IS NOT NULL 
AND current_job_title != '';

-- Note: current_job_title is kept for backward compatibility and can be used as a display field
-- You may want to remove it later or keep it as a denormalized field for display purposes

