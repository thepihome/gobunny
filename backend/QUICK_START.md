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
wrangler d1 create godashprodcore01
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
database_name = "godashprodcore01"
database_id = "paste-your-id-here"  # ← Paste here
```

### 3. Run Database Migration

```bash
# For local development
wrangler d1 execute godashprodcore01 --local --file=./database/d1-schema.sql

# For production (after you deploy)
wrangler d1 execute godashprodcore01 --file=./database/d1-schema.sql
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

Production and dev/preview use **separate Workers** (`--env production` vs `--env dev`). Set secrets per environment:

```bash
# Production (main branch frontend)
wrangler secret put JWT_SECRET --env production
wrangler secret put JWT_EXPIRE --env production   # e.g. 7d
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put FRONTEND_URLS --env production
# e.g. https://godash.gobunnyy.com,https://gobunny.pages.dev

# Dev / preview (dev/godash-future-builds frontend)
wrangler secret put JWT_SECRET --env dev
wrangler secret put JWT_EXPIRE --env dev
wrangler secret put GOOGLE_CLIENT_ID --env dev
wrangler secret put FRONTEND_URLS --env dev
# e.g. https://dev-godash-future-builds.gobunnyy.pages.dev,http://localhost:3000
```

Before first dev deploy, create the dev D1 database and update `[env.dev]` in `wrangler.toml`:

```bash
wrangler d1 create gobunny-dev
wrangler d1 execute gobunny-dev --file=./database/d1-schema.sql --env dev
wrangler r2 bucket create resume-uploads-dev   # optional
```

### 6. Test Locally

```bash
wrangler dev --env dev
```

This will start a local development server. Test the health endpoint:
```bash
curl http://localhost:8787/api/health
```

### 7. Deploy

```bash
# Production worker (main)
wrangler deploy --env production

# Dev worker (preview branch)
wrangler deploy --env dev
```

After deployment, note your Workers URLs:
- Production: `https://gobunnyy-backend.<account>.workers.dev`
- Dev: `https://gobunnyy-backend-dev.<account>.workers.dev`

Set matching `REACT_APP_API_URL` and `REACT_APP_GOOGLE_CLIENT_ID` in Cloudflare Pages → **Production** vs **Preview** environment variables.

## Common Issues

### "Couldn't find a D1 DB with the name or binding 'godashprodcore01'"

**Solution**: Make sure you:
1. Created the database: `wrangler d1 create godashprodcore01`
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

