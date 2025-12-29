# Troubleshooting Guide

## User Registration Not Creating Users in Database

### Symptoms
- Registration appears to succeed (no browser errors)
- User is not created in D1 database
- No errors in browser console

### Possible Causes

1. **Database Not Initialized**
   - Schema migration not run
   - Tables don't exist

2. **Database Binding Issue**
   - `wrangler.toml` database_id incorrect
   - Database binding name mismatch

3. **Silent Errors**
   - Errors caught but not logged properly
   - Last insert ID not returned correctly

### Debugging Steps

#### 1. Check Database Connection

```bash
cd backend
wrangler d1 execute job-hunting-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Should return a list of tables including `users`.

#### 2. Check if Users Table Exists

```bash
wrangler d1 execute job-hunting-db --command="SELECT COUNT(*) as count FROM users"
```

#### 3. Check Worker Logs

```bash
wrangler tail
```

Then try registering a user and watch for errors.

#### 4. Test Database Insert Manually

```bash
wrangler d1 execute job-hunting-db --command="INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ('test@example.com', 'hash', 'Test', 'User', 'candidate')"
```

#### 5. Check Environment Variables

```bash
wrangler secret list
```

Verify:
- `JWT_SECRET` is set
- `JWT_EXPIRE` is set
- `FRONTEND_URL` is set

#### 6. Verify Database ID in wrangler.toml

Check that `database_id` matches your actual D1 database ID.

### Common Fixes

1. **Run Database Migration**
   ```bash
   wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
   ```

2. **Check Database Binding**
   - In `wrangler.toml`, verify `binding = "DB"` matches code
   - In code, verify `env.DB` is used (not `env.DATABASE`)

3. **Add Better Error Logging**
   - Check Worker logs in Cloudflare Dashboard
   - Look for database errors
   - Check for missing environment variables

4. **Test Locally First**
   ```bash
   wrangler dev
   ```
   Then test registration locally before deploying.

### Quick Test

Try this SQL directly in D1:

```sql
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('test@test.com', 'testhash', 'Test', 'User', 'candidate');

SELECT * FROM users WHERE email = 'test@test.com';
```

If this works, the issue is in the Worker code. If it doesn't, the issue is with the database setup.

