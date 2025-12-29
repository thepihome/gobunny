# Cloudflare Deployment Guide

This guide covers deploying your full-stack application to Cloudflare. Since your backend uses Express.js and PostgreSQL, we'll use a hybrid approach.

## Architecture Overview

- **Frontend**: Deploy to Cloudflare Pages (static React build)
- **Backend**: Two options:
  1. **Recommended**: Deploy backend to a traditional hosting service (Railway, Render, Fly.io) and connect from Cloudflare Pages
  2. **Advanced**: Migrate backend to Cloudflare Workers + D1 (requires significant refactoring)

## Option 1: Frontend on Cloudflare Pages + Backend on Traditional Hosting (Recommended)

This is the easiest and most practical approach.

### Step 1: Deploy Backend to a Hosting Service

Choose one of these services:

#### Option A: Railway
1. Sign up at [railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Add a PostgreSQL service
5. Set environment variables:
   ```
   PORT=5000
   DB_HOST=<railway-postgres-host>
   DB_PORT=5432
   DB_NAME=railway
   DB_USER=postgres
   DB_PASSWORD=<railway-password>
   JWT_SECRET=<your-secret>
   JWT_EXPIRE=7d
   NODE_ENV=production
   FRONTEND_URL=https://your-app.pages.dev
   ```
6. Deploy the backend folder

#### Option B: Render
1. Sign up at [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set root directory to `backend`
5. Build command: `npm install`
6. Start command: `npm start`
7. Add PostgreSQL database
8. Set environment variables similar to Railway

#### Option C: Fly.io
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run `fly launch` in the backend directory
3. Add PostgreSQL: `fly postgres create`
4. Attach database: `fly postgres attach <db-name>`
5. Set environment variables

### Step 2: Deploy Frontend to Cloudflare Pages

1. **Build your frontend locally first** (to test):
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Set up Cloudflare Pages**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Pages** → **Create a project**
   - Connect your GitHub repository
   - Configure build settings:
     - **Framework preset**: Create React App
     - **Build command**: `cd frontend && npm install && npm run build`
     - **Build output directory**: `frontend/build`
     - **Root directory**: `/` (root of repo)

3. **Set Environment Variables** in Cloudflare Pages:
   - Go to your Pages project → Settings → Environment Variables
   - Add:
     ```
     REACT_APP_API_URL=https://your-backend-url.com/api
     ```
   - Replace `your-backend-url.com` with your actual backend URL from Step 1

4. **Deploy**:
   - Cloudflare will automatically deploy on every push to your main branch
   - Or manually trigger a deployment

### Step 3: Update CORS Settings

In your backend `.env` file (on your hosting service), make sure:
```
FRONTEND_URL=https://your-app.pages.dev
```

This allows your Cloudflare Pages frontend to communicate with your backend.

## Option 2: Full Cloudflare Deployment (Advanced)

This requires migrating your backend to Cloudflare Workers and using D1 (SQLite) instead of PostgreSQL.

### Limitations:
- Workers don't support Express.js directly
- Need to rewrite backend using Workers API
- D1 is SQLite, not PostgreSQL (schema migration needed)
- File uploads need special handling with R2 storage
- More complex setup

### If you want to proceed with this option:

1. **Set up D1 Database**:
   ```bash
   # Install Wrangler CLI
   npm install -g wrangler
   
   # Create D1 database
   wrangler d1 create job-hunting-db
   ```

2. **Migrate schema** from PostgreSQL to SQLite (D1)

3. **Rewrite backend** to use Workers API instead of Express

4. **Set up R2** for file storage (resumes)

This is a significant refactoring effort. Option 1 is recommended unless you specifically need Cloudflare Workers features.

## Post-Deployment Checklist

- [ ] Backend is accessible and health check works
- [ ] Frontend can connect to backend API
- [ ] CORS is properly configured
- [ ] Environment variables are set correctly
- [ ] Database is accessible from backend
- [ ] File uploads work (if using traditional hosting, ensure uploads directory is writable)
- [ ] SSL certificates are active (automatic with Cloudflare Pages)

## Custom Domain Setup

1. In Cloudflare Pages, go to **Custom domains**
2. Add your domain
3. Update DNS records as instructed
4. SSL will be automatically provisioned

## Troubleshooting

### Frontend can't connect to backend
- Check `REACT_APP_API_URL` environment variable in Cloudflare Pages
- Verify backend CORS settings include your Pages URL
- Check browser console for CORS errors

### Backend database connection issues
- Verify database credentials in hosting service
- Check if database is accessible from your hosting service
- Ensure database is running and not paused (some services pause inactive databases)

### Build failures
- Check build logs in Cloudflare Pages
- Ensure all dependencies are in `package.json`
- Verify build command is correct

## Environment Variables Reference

### Frontend (Cloudflare Pages)
```
REACT_APP_API_URL=https://your-backend-url.com/api
```

### Backend (Hosting Service)
```
PORT=5000
DB_HOST=<database-host>
DB_PORT=5432
DB_NAME=<database-name>
DB_USER=<database-user>
DB_PASSWORD=<database-password>
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRE=7d
NODE_ENV=production
FRONTEND_URL=https://your-app.pages.dev
```

