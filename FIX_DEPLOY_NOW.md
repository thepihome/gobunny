# Fix: addCorsHeaders is not defined

## The Problem
The error `ReferenceError: addCorsHeaders is not defined` means the deployed code is outdated. The import was added but not deployed yet.

## Quick Fix

### Step 1: Deploy Updated Backend

```bash
cd backend
wrangler deploy
```

This will deploy the latest code with the `addCorsHeaders` import fixed.

### Step 2: Verify Deployment

After deployment, test registration again. The error should be gone.

### Step 3: If Still Failing - Check Database

After fixing the import error, registration might still fail if database tables don't exist:

```bash
# Check if tables exist
wrangler d1 execute job-hunting-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# If no tables, run migration
wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
```

## What Was Fixed

1. ✅ Added `addCorsHeaders` to imports in `router.js`
2. ✅ Fixed CORS handling to use request origin
3. ✅ Added better error logging
4. ✅ Added `/api` endpoint handler

## After Deployment

1. Test registration - should work now
2. Check Worker logs: `wrangler tail` - should see registration logs
3. Verify user created: Check `/api/health/db` for user count

