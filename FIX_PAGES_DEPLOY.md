# Fix Cloudflare Pages Deploy Command Error

## Problem
The build succeeds but deployment fails with:
```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

This happens because Cloudflare Pages has a **deploy command** configured that shouldn't be there.

## Solution

### Step 1: Go to Cloudflare Pages Dashboard
1. Visit https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **Pages**
3. Click on your project (e.g., `gobunnyy-frontend`)

### Step 2: Update Build Settings
1. Go to **Settings** → **Builds & deployments**
2. Scroll down to **Build configuration**

### Step 3: Remove or Clear Deploy Command
1. Find the **Deploy command** field
2. **Clear it completely** (leave it empty) OR remove it
3. **Do NOT** set it to `npx wrangler deploy` - that's for Workers, not Pages!

### Step 4: Verify Build Settings
Your settings should look like this:

- **Framework preset**: `Create React App`
- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/build`
- **Root directory**: `/` (or leave default)
- **Deploy command**: (empty/blank) ← **This is the key fix!**

### Step 5: Save and Redeploy
1. Click **Save**
2. Go to **Deployments** tab
3. Click **Retry deployment** on the failed deployment, OR
4. Push a new commit to trigger a new deployment

## Why This Happens

- **Cloudflare Pages** automatically deploys the build output - no deploy command needed
- **Cloudflare Workers** use `wrangler deploy` - but that's for backend, not frontend
- The deploy command field is optional and should be left empty for Pages

## Alternative: Use GitHub Actions

If you prefer, you can also use the GitHub Actions workflow (`.github/workflows/cloudflare-pages.yml`) instead of Cloudflare's built-in Git integration. This gives you more control but requires setting up GitHub secrets.

## Quick Fix Summary

**In Cloudflare Pages Dashboard:**
1. Settings → Builds & deployments
2. Clear the "Deploy command" field
3. Save
4. Redeploy

That's it! The build already succeeded, so once you remove the deploy command, it should deploy automatically.

