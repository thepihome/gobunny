# Cloudflare Deployment Guide - Full Stack

This guide covers deploying both frontend and backend to Cloudflare.

## Architecture

- **Frontend**: Cloudflare Pages (React static build)
- **Backend**: Cloudflare Workers (with D1 database and R2 storage)

## Prerequisites

1. Cloudflare account
2. Wrangler CLI installed: `npm install -g wrangler`
3. Node.js 18+ installed

## Step 1: Set Up Cloudflare D1 Database

1. **Create D1 database**:
   ```bash
   cd backend
   wrangler d1 create job-hunting-db
   ```

2. **Note the database ID** from the output and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "job-hunting-db"
   database_id = "your-database-id-here"
   ```

3. **Run the schema migration**:
   ```bash
   wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
   ```

   For local development:
   ```bash
   wrangler d1 execute job-hunting-db --local --file=./database/d1-schema.sql
   ```

## Step 2: Set Up R2 Bucket for File Storage

1. **Create R2 bucket** (via Cloudflare Dashboard or CLI):
   - Go to Cloudflare Dashboard → R2 → Create bucket
   - Name it: `resume-uploads`

2. **Update `wrangler.toml`** (already configured):
   ```toml
   [[r2_buckets]]
   binding = "R2_BUCKET"
   bucket_name = "resume-uploads"
   ```

## Step 3: Install Dependencies

```bash
cd backend
npm install
# Or if using the workers-specific package:
# Use package-workers.json as reference
```

## Step 4: Set Environment Variables

Set secrets in Cloudflare Workers:

```bash
wrangler secret put JWT_SECRET
# Enter your JWT secret when prompted

wrangler secret put JWT_EXPIRE
# Enter: 7d

wrangler secret put FRONTEND_URL
# Enter your Cloudflare Pages URL (e.g., https://your-app.pages.dev)
```

## Step 5: Deploy Backend to Cloudflare Workers

1. **Test locally first**:
   ```bash
   cd backend
   wrangler dev
   ```

2. **Deploy to production**:
   ```bash
   wrangler deploy
   ```

3. **Note your Workers URL** (e.g., `https://gobunnyy-backend.your-subdomain.workers.dev`)

## Step 6: Deploy Frontend to Cloudflare Pages

1. **Build the frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Deploy via Cloudflare Dashboard**:
   - Go to Cloudflare Dashboard → Pages → Create a project
   - Connect your GitHub repository
   - Configure build settings:
     - **Framework preset**: Create React App
     - **Build command**: `cd frontend && npm install && npm run build`
     - **Build output directory**: `frontend/build`
     - **Root directory**: `/` (root of repo)

3. **Set Environment Variable**:
   - Go to your Pages project → Settings → Environment Variables
   - Add: `REACT_APP_API_URL` = `https://gobunnyy-backend.your-subdomain.workers.dev/api`

4. **Deploy**: Cloudflare will automatically deploy on push to main branch

## Step 7: Update CORS Settings

In your Workers backend, update the CORS headers in `backend/src/utils/cors.js`:

```javascript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-app.pages.dev', // Your Pages URL
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};
```

Or use environment variable:
```javascript
'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
```

## Step 8: Initialize Database with Default Admin

After deployment, you'll need to create an admin user. You can:

1. Use the registration endpoint to create an admin user
2. Or run a script to create the default admin (needs to be adapted for Workers)

## Project Structure

```
backend/
├── worker.js                 # Main Workers entry point
├── wrangler.toml             # Workers configuration
├── src/
│   ├── router.js             # Main router
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   ├── routes/               # API route handlers
│   │   ├── auth.js           # ✅ Implemented
│   │   ├── jobs.js           # ✅ Implemented
│   │   ├── resumes.js        # ✅ Implemented (with R2)
│   │   └── ...               # Other routes (stubs)
│   └── utils/
│       ├── db.js             # D1 database utilities
│       └── cors.js           # CORS utilities
└── database/
    └── d1-schema.sql         # D1 (SQLite) schema
```

## Development Workflow

### Local Development

1. **Start local D1 database**:
   ```bash
   wrangler dev
   ```

2. **Run migrations locally**:
   ```bash
   wrangler d1 execute job-hunting-db --local --file=./database/d1-schema.sql
   ```

3. **Test locally**: Workers will run on `http://localhost:8787`

### Production Deployment

1. **Deploy backend**:
   ```bash
   cd backend
   wrangler deploy
   ```

2. **Frontend auto-deploys** via Cloudflare Pages on git push

## Important Notes

### Database Differences (PostgreSQL → SQLite/D1)

- `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `VARCHAR` → `TEXT`
- `TIMESTAMP` → `TEXT` (ISO format) or `INTEGER` (Unix timestamp)
- `TEXT[]` → `TEXT` (store as JSON string)
- `JSONB` → `TEXT` (store as JSON string)
- `DECIMAL` → `REAL`
- `ILIKE` → `LIKE` (case-insensitive search needs different approach)

### Password Hashing

The current implementation uses SHA-256 (simplified). For production, consider:
- Using a proper bcrypt implementation for Workers
- Or using Cloudflare's Workers Secrets for additional security

### JWT Implementation

The current JWT implementation is simplified. For production:
- Use a proper JWT library compatible with Workers
- Or implement proper HMAC-SHA256 signing with Web Crypto API

### Remaining Work

The following routes are stubs and need full implementation:
- `/api/matches` - Job matching logic
- `/api/candidates` - Candidate management
- `/api/candidate-profiles` - Profile management
- `/api/timesheets` - Timesheet tracking
- `/api/kpis` - KPI management
- `/api/users` - User management (admin)
- `/api/groups` - Group management
- `/api/permissions` - Permission management
- `/api/crm` - CRM interactions

## Troubleshooting

### Database Connection Issues
- Verify `database_id` in `wrangler.toml` matches your D1 database
- Check that migrations ran successfully
- Use `wrangler d1 execute job-hunting-db --command="SELECT * FROM users LIMIT 1"` to test

### R2 Upload Issues
- Verify R2 bucket name matches in `wrangler.toml`
- Check bucket permissions
- Verify file size limits (5MB default)

### CORS Issues
- Verify `FRONTEND_URL` secret is set correctly
- Check CORS headers in `cors.js`
- Ensure frontend URL matches exactly (including https)

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check token expiration settings
- Verify password hashing is working

## Cost Considerations

- **Cloudflare Pages**: Free tier includes generous limits
- **Cloudflare Workers**: Free tier includes 100,000 requests/day
- **D1 Database**: Free tier includes 5GB storage, 5M reads/month
- **R2 Storage**: $0.015/GB storage, $4.50/TB egress

## Next Steps

1. Complete implementation of remaining route handlers
2. Add proper JWT signing/verification
3. Implement proper password hashing (bcrypt alternative)
4. Add error handling and logging
5. Set up monitoring and alerts
6. Configure custom domains
7. Set up CI/CD pipelines

