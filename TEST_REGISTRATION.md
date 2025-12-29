# Test Registration Endpoint

## Test the Registration Endpoint Directly

Use this curl command to test registration:

```bash
curl -X POST https://gobunnyy-backend.picloud.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://gobunny.pages.dev" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "first_name": "Test",
    "last_name": "User",
    "role": "candidate"
  }'
```

## Expected Response

**If successful (201):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "role": "candidate"
  }
}
```

**If database error (500):**
```json
{
  "error": "Registration failed",
  "message": "Database error: ..."
}
```

**If user exists (400):**
```json
{
  "error": "User already exists"
}
```

## Check What's Happening

1. **Test the endpoint directly** (curl command above)
2. **Check browser Network tab** when clicking register
3. **Check Worker logs**: `wrangler tail`
4. **Check database**: Visit `/api/health/db`

## Common Issues

### Issue: "No token provided" on `/api`
- This is expected - `/api` is not a valid endpoint
- Use `/api/auth/register` for registration
- Use `/api/health` for health check

### Issue: Registration returns 500
- Database tables don't exist
- Run: `wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql`

### Issue: Registration returns 404
- Route not found
- Check if path is exactly `/api/auth/register`
- Verify backend is deployed

