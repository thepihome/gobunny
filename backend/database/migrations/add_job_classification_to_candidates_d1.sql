-- Migration: Add job_classification (ID) to candidate_profiles table for D1 (SQLite)
-- This changes current_job_title from TEXT to use job_roles ID reference

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
AND current_job_title != ''
AND job_classification IS NULL;

-- Step 3: Verify migration (optional - for checking results)
-- Uncomment to see migration results:
-- SELECT 
--   COUNT(*) as total_candidates,
--   COUNT(job_classification) as with_classification,
--   COUNT(*) - COUNT(job_classification) as without_classification
-- FROM candidate_profiles;

-- Note: current_job_title is kept for backward compatibility
-- You can remove it later if desired, but it's recommended to keep it for now

