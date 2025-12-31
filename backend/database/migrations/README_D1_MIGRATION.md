# D1 Migration Guide: Add job_classification to candidate_profiles

## Overview
This migration adds a `job_classification` column (INTEGER, foreign key to `job_roles.id`) to the `candidate_profiles` table in your D1 database.

## Prerequisites
- D1 database already created
- `job_roles` table exists with data
- `candidate_profiles` table exists

## Method 1: Using Wrangler CLI (Recommended)

### Step 1: Navigate to backend directory
```bash
cd backend
```

### Step 2: Run the migration
```bash
wrangler d1 execute YOUR_DATABASE_NAME --file=database/migrations/add_job_classification_to_candidates_d1.sql
```

Replace `YOUR_DATABASE_NAME` with your actual D1 database name (usually found in `wrangler.toml`).

### Step 3: Verify migration
```bash
wrangler d1 execute YOUR_DATABASE_NAME --command="SELECT COUNT(*) as total, COUNT(job_classification) as with_classification FROM candidate_profiles;"
```

## Method 2: Using Cloudflare Dashboard

### Step 1: Open D1 Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **D1**
3. Select your database

### Step 2: Execute SQL
1. Click on **"Execute SQL"** tab
2. Copy and paste the contents of `add_job_classification_to_candidates_d1.sql`
3. Click **"Run"**

### Step 3: Verify
Run this query to check migration results:
```sql
SELECT 
  COUNT(*) as total_candidates,
  COUNT(job_classification) as with_classification,
  COUNT(*) - COUNT(job_classification) as without_classification
FROM candidate_profiles;
```

## Method 3: Using Wrangler with Remote Database

If you need to run against a remote database:
```bash
wrangler d1 execute YOUR_DATABASE_NAME --remote --file=database/migrations/add_job_classification_to_candidates_d1.sql
```

## What the Migration Does

1. **Adds `job_classification` column** to `candidate_profiles` table
2. **Migrates existing data**:
   - Finds candidates with `current_job_title` set
   - Looks up the matching job role in `job_roles` table by name
   - Sets `job_classification` to the job role ID
3. **Keeps `current_job_title`** for backward compatibility

## Troubleshooting

### Error: "no such column: job_classification"
- The column already exists, or the migration didn't run
- Check if column exists: `PRAGMA table_info(candidate_profiles);`

### Error: "no such table: job_roles"
- Make sure `job_roles` table exists
- Run the main schema first: `wrangler d1 execute YOUR_DATABASE_NAME --file=database/d1-schema.sql`

### No candidates migrated
- Check if candidates have `current_job_title` set
- Check if job roles exist: `SELECT * FROM job_roles;`
- Verify name matching: Run this to see unmigrated candidates:
  ```sql
  SELECT DISTINCT current_job_title 
  FROM candidate_profiles 
  WHERE current_job_title IS NOT NULL 
  AND current_job_title != ''
  AND job_classification IS NULL;
  ```

### Candidates not matching job roles
If some candidates couldn't be migrated (no matching job role found):
1. Create the missing job roles in the Metadata section of the app
2. Re-run the migration (it will only update NULL values)

## Verification Queries

### Check migration status
```sql
SELECT 
  COUNT(*) as total,
  COUNT(job_classification) as with_classification,
  COUNT(*) - COUNT(job_classification) as without_classification
FROM candidate_profiles;
```

### See unmigrated candidates
```sql
SELECT 
  id, 
  user_id, 
  current_job_title,
  job_classification
FROM candidate_profiles 
WHERE current_job_title IS NOT NULL 
AND current_job_title != ''
AND job_classification IS NULL;
```

### See successfully migrated candidates
```sql
SELECT 
  cp.id,
  cp.current_job_title,
  cp.job_classification,
  jr.name as job_role_name
FROM candidate_profiles cp
LEFT JOIN job_roles jr ON cp.job_classification = jr.id
WHERE cp.job_classification IS NOT NULL;
```

## Rollback (if needed)

If you need to remove the column:
```sql
-- Note: SQLite doesn't support DROP COLUMN directly
-- You would need to recreate the table or use a workaround
-- This is not recommended after data migration
```

## Next Steps

After migration:
1. ✅ Verify candidates are showing job classifications correctly
2. ✅ Test creating new candidates with job classification
3. ✅ Test job matching functionality
4. ✅ Update your application code to use `job_classification` instead of `current_job_title`

