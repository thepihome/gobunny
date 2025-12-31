# Migration: Add job_classification to candidate_profiles

## Overview
This migration adds a `job_classification` column (INTEGER, foreign key to `job_roles.id`) to the `candidate_profiles` table, matching the structure used in the `jobs` table. This replaces storing job classification as text in `current_job_title`.

## When to Run
- ✅ **Run this migration** if your database already exists
- ❌ **Skip this migration** if you're setting up a new database (the schema.sql already includes this column)

## Quick Migration

### For PostgreSQL (Express Backend)
```bash
cd backend
npm run migrate:candidate-classification
```

### For D1 (Cloudflare Workers)
```bash
# Using Wrangler CLI
wrangler d1 execute YOUR_DATABASE_NAME --file=backend/database/migrations/add_job_classification_to_candidates.sql
```

Or via Cloudflare Dashboard:
1. Go to Cloudflare Dashboard > Workers & Pages > D1
2. Select your database
3. Go to "Execute SQL" tab
4. Run the SQL from `add_job_classification_to_candidates.sql`

## What This Does

1. **Adds `job_classification` column** to `candidate_profiles` table
2. **Migrates existing data** from `current_job_title` (text) to `job_classification` (ID) by:
   - Looking up job role names in `job_roles` table
   - Setting the corresponding ID in `job_classification`
3. **Keeps `current_job_title`** for backward compatibility (can be removed later)

## After Migration

- Frontend forms now store `job_classification` (ID) instead of `current_job_title` (text)
- Matching logic uses direct ID comparison (more reliable)
- `current_job_title` is kept for display/backward compatibility

## Verification

After running the migration, verify:
```sql
-- Check candidates with job_classification
SELECT COUNT(*) FROM candidate_profiles WHERE job_classification IS NOT NULL;

-- Check candidates without job_classification (should be minimal)
SELECT COUNT(*) FROM candidate_profiles 
WHERE current_job_title IS NOT NULL 
AND current_job_title != '' 
AND job_classification IS NULL;
```

## Rollback

If needed, you can remove the column:
```sql
ALTER TABLE candidate_profiles DROP COLUMN job_classification;
```

Note: This will lose the migrated data, so only do this if you haven't started using the new field yet.

