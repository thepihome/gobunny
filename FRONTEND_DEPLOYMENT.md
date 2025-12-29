# Frontend Deployment Guide - Cloudflare Pages

## Prerequisites

- Backend deployed to Cloudflare Workers (you've done this ✅)
- Your backend Workers URL (e.g., `https://gobunnyy-backend.your-subdomain.workers.dev`)
- GitHub repository with your code (recommended) OR ability to upload files

## Step 1: Get Your Backend URL

First, note your backend Workers URL. You can find it:
- In the output from `wrangler deploy`
- In Cloudflare Dashboard → Workers & Pages → Your Worker

It will look like: `https://gobunnyy-backend.your-subdomain.workers.dev`

## Step 2: Deploy Frontend via Cloudflare Dashboard

### Option A: Connect GitHub Repository (Recommended)

1. **Go to Cloudflare Dashboard**:
   - Visit https://dash.cloudflare.com
   - Navigate to **Workers & Pages** → **Pages**
   - Click **Create a project**

2. **Connect Repository**:
   - Click **Connect to Git**
   - Authorize Cloudflare to access your GitHub/GitLab/Bitbucket
   - Select your repository (`gobunnyy`)

3. **Configure Build Settings**:
   - **Project name**: `gobunnyy-frontend` (or any name you prefer)
   - **Production branch**: `main` (or `master`)
   - **Framework preset**: `Create React App`
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/build`
   - **Root directory**: `/` (leave as default)

4. **Set Environment Variables**:
   - Click **Environment variables** (or set after creation)
   - Add variable:
     - **Variable name**: `REACT_APP_API_URL`
     - **Value**: `https://your-backend-url.workers.dev/api`
     - Replace `your-backend-url` with your actual Workers URL
   - Make sure it's set for **Production** environment

5. **Deploy**:
   - Click **Save and Deploy**
   - Cloudflare will build and deploy your frontend
   - Wait for deployment to complete (usually 2-5 minutes)

### Option B: Direct Upload (Alternative)

1. **Build Locally**:
   ```bash
   cd frontend
   npm install
   REACT_APP_API_URL=https://your-backend-url.workers.dev/api npm run build
   ```

2. **Upload to Cloudflare Pages**:
   - Go to Cloudflare Dashboard → Pages
   - Click **Create a project** → **Upload assets**
   - Upload the `frontend/build` folder contents
   - Set environment variable `REACT_APP_API_URL` in project settings

## Step 3: Update Backend CORS (If Needed)

Make sure your backend allows requests from your frontend domain:

1. **Get your frontend Pages URL**:
   - After deployment, you'll get a URL like: `https://gobunnyy-frontend.pages.dev`

2. **Update Backend CORS**:
   - The backend should already use `FRONTEND_URL` environment variable
   - Update the secret:
     ```bash
     cd backend
     wrangler secret put FRONTEND_URL
     # Enter: https://gobunnyy-frontend.pages.dev
     ```

   OR update `backend/src/utils/cors.js` if needed.

## Step 4: Test Your Application

1. **Visit your frontend URL**:
   - Go to: `https://your-frontend-name.pages.dev`

2. **Test Registration/Login**:
   - Try registering a new user
   - Or login if you have an account
   - Check browser console for any errors

3. **Verify API Connection**:
   - Open browser DevTools → Network tab
   - Check that API calls go to your Workers backend
   - Verify responses are successful

## Step 5: Set Up Custom Domain (Optional)

1. **In Cloudflare Pages**:
   - Go to your project → **Custom domains**
   - Click **Set up a custom domain**
   - Enter your domain name

2. **Update DNS**:
   - Cloudflare will provide DNS records to add
   - SSL certificate will be automatically provisioned

3. **Update Environment Variables**:
   - Update `FRONTEND_URL` in backend to your custom domain
   - Update `REACT_APP_API_URL` if needed

## Troubleshooting

### Frontend Can't Connect to Backend

**Symptoms**: Network errors, CORS errors, 401/403 errors

**Solutions**:
1. Check `REACT_APP_API_URL` is set correctly in Pages environment variables
2. Verify backend URL is correct (no trailing slash, includes `/api`)
3. Check backend CORS settings
4. Verify `FRONTEND_URL` secret in backend matches your frontend domain

### Build Fails

**Symptoms**: Deployment fails during build

**Solutions**:
1. Check build logs in Cloudflare Pages
2. Verify `package.json` has all dependencies
3. Make sure build command is correct
4. Check for TypeScript/ESLint errors

### React Router Not Working

**Symptoms**: 404 errors when navigating to routes

**Solutions**:
1. Verify `frontend/public/_redirects` file exists with: `/*    /index.html   200`
2. Cloudflare Pages should handle this automatically, but check if needed

### Environment Variables Not Working

**Symptoms**: API calls go to wrong URL

**Solutions**:
1. Environment variables must start with `REACT_APP_` for Create React App
2. Rebuild after changing environment variables
3. Check variable is set for correct environment (Production/Preview)

## Quick Reference

### Frontend URL Format
```
https://your-project-name.pages.dev
```

### Backend URL Format
```
https://your-worker-name.your-subdomain.workers.dev
```

### Environment Variables Needed

**Frontend (Cloudflare Pages)**:
- `REACT_APP_API_URL` = `https://your-backend-url.workers.dev/api`

**Backend (Cloudflare Workers)**:
- `JWT_SECRET` = (your secret key)
- `JWT_EXPIRE` = `7d`
- `FRONTEND_URL` = `https://your-frontend-url.pages.dev`

## Next Steps After Deployment

1. ✅ Test user registration
2. ✅ Test user login
3. ✅ Test job creation (if you're a consultant/admin)
4. ✅ Test resume upload
5. ✅ Test job matching
6. ✅ Create your first admin user (via registration or database)

## Creating Your First Admin User

After deployment, you can create an admin user by:

1. **Via Registration** (if allowed):
   - Register with role: `admin`
   - Or register normally and update in database

2. **Via Database** (if you have access):
   ```sql
   INSERT INTO users (email, password_hash, first_name, last_name, role)
   VALUES ('admin@example.com', 'hashed_password', 'Admin', 'User', 'admin');
   ```

3. **Via API** (if registration allows admin role):
   - POST to `/api/auth/register` with `role: 'admin'`

## Support

If you encounter issues:
1. Check Cloudflare Pages build logs
2. Check browser console for errors
3. Check Network tab for API call failures
4. Verify all environment variables are set correctly
5. Check backend logs in Cloudflare Dashboard

