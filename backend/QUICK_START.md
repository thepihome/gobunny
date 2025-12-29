# Quick Start Guide

## Prerequisites

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

## Step-by-Step Setup

### 1. Create D1 Database

```bash
cd backend
wrangler d1 create job-hunting-db
```

**Copy the `database_id` from the output!** It will look like:
```
database_id = "abc123def456ghi789jkl012mno345pqr678"
```

### 2. Update wrangler.toml

Open `backend/wrangler.toml` and paste the `database_id` you copied:

```toml
[[d1_databases]]
binding = "DB"
database_name = "job-hunting-db"
database_id = "paste-your-id-here"  # ← Paste here
```

### 3. Run Database Migration

```bash
# For local development
wrangler d1 execute job-hunting-db --local --file=./database/d1-schema.sql

# For production (after you deploy)
wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
```

### 4. Create R2 Bucket (Optional - for file uploads)

Via Cloudflare Dashboard:
1. Go to https://dash.cloudflare.com
2. Navigate to **R2** → **Create bucket**
3. Name it: `resume-uploads`

Or via CLI (if available):
```bash
# Note: R2 bucket creation via CLI may require additional setup
# It's easier to create via the dashboard
```

### 5. Set Environment Secrets

```bash
# Set JWT secret
wrangler secret put JWT_SECRET
# When prompted, enter a strong random string

# Set JWT expiration
wrangler secret put JWT_EXPIRE
# When prompted, enter: 7d

# Set frontend URL (update after deploying frontend)
wrangler secret put FRONTEND_URL
# When prompted, enter: https://your-app.pages.dev
```

### 6. Test Locally

```bash
wrangler dev
```

This will start a local development server. Test the health endpoint:
```bash
curl http://localhost:8787/api/health
```

### 7. Deploy to Production

```bash
wrangler deploy
```

After deployment, note your Workers URL (e.g., `https://gobunnyy-backend.your-subdomain.workers.dev`)

## Common Issues

### "Couldn't find a D1 DB with the name or binding 'job-hunting-db'"

**Solution**: Make sure you:
1. Created the database: `wrangler d1 create job-hunting-db`
2. Updated `wrangler.toml` with the `database_id`
3. The `database_name` matches exactly

### "Permission denied" or Network Errors

**Solution**: 
1. Make sure you're logged in: `wrangler login`
2. Check your account: `wrangler whoami`
3. Ensure you have network access

### Database Migration Fails

**Solution**:
- Make sure the `database_id` is set in `wrangler.toml`
- Try running the migration with `--local` flag first
- Check the SQL file syntax

## Next Steps

After setting up the backend:
1. Deploy frontend to Cloudflare Pages
2. Update `FRONTEND_URL` secret
3. Update frontend's `REACT_APP_API_URL` environment variable
4. Test the full application

See `CLOUDFLARE_DEPLOYMENT.md` for complete deployment instructions.

