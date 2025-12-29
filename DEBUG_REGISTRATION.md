# Debugging User Registration Issue

## Current Problem
- Registration appears to succeed (no browser errors)
- User is not created in database
- Getting "No token provided" error

## Debugging Steps

### 1. Check Database Tables Exist

Run this command to verify tables exist in production:

```bash
cd backend
wrangler d1 execute job-hunting-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**Expected output**: Should list tables including `users`, `jobs`, `resumes`, etc.

**If tables don't exist**: Run migration:
```bash
wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
```

### 2. Check Worker Logs

Watch logs in real-time while registering:

```bash
cd backend
wrangler tail
```

Then try registering a user. Look for:
- "Attempting to insert user" log
- "Insert result" log
- Any database errors
- "User created with ID" log

### 3. Test Database Health Endpoint

Visit in browser:
```
https://gobunnyy-backend.picloud.workers.dev/api/health/db
```

This will show:
- Database connection status
- List of tables
- Current user count

### 4. Test Manual Insert

Try inserting a user directly:

```bash
cd backend
wrangler d1 execute job-hunting-db --command="INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ('test@example.com', 'testhash123', 'Test', 'User', 'candidate')"

# Check if it was created
wrangler d1 execute job-hunting-db --command="SELECT * FROM users WHERE email='test@example.com'"
```

### 5. Check Browser Network Tab

1. Open browser DevTools → Network tab
2. Try registering a user
3. Look for the `/api/auth/register` request
4. Check:
   - Request payload (is data being sent?)
   - Response status code
   - Response body (what error message?)
   - Response headers

### 6. Check Environment Variables

Verify secrets are set:

```bash
cd backend
wrangler secret list
```

Should show:
- `JWT_SECRET`
- `JWT_EXPIRE`
- `FRONTEND_URL`

### 7. Common Issues & Fixes

#### Issue: Tables Don't Exist
**Fix**: Run migration on production database
```bash
wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
```

#### Issue: Database Binding Wrong
**Check**: `wrangler.toml` has correct `database_id` and `binding = "DB"`

#### Issue: Database ID Mismatch
**Fix**: Update `database_id` in `wrangler.toml` to match your actual D1 database

#### Issue: Silent Errors
**Fix**: Check Worker logs with `wrangler tail` to see actual errors

## Expected Flow

1. Frontend sends POST to `/api/auth/register`
2. Backend checks if user exists
3. Backend hashes password
4. Backend inserts into `users` table
5. Backend gets `last_row_id` from insert
6. Backend queries user by ID to verify
7. Backend generates JWT token
8. Backend returns `{ token, user }`
9. Frontend stores token and navigates to dashboard

## What to Check

- [ ] Database tables exist (run Step 1)
- [ ] Migration was run on production (not just local)
- [ ] Worker logs show registration attempt
- [ ] No database errors in logs
- [ ] `last_row_id` is returned from insert
- [ ] User query after insert succeeds
- [ ] Token is generated
- [ ] Response includes token and user

## Next Steps After Debugging

Once you identify the issue:
1. Fix the root cause (likely missing tables)
2. Deploy updated backend: `wrangler deploy`
3. Test registration again
4. Verify user in database: `wrangler d1 execute job-hunting-db --command="SELECT * FROM users"`

