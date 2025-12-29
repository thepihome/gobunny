# Complete Deployment Checklist

Use this checklist to ensure everything is deployed correctly.

## ✅ Backend Deployment (Cloudflare Workers)

- [x] D1 database created
- [x] Database ID added to `wrangler.toml`
- [x] Database schema migrated
- [ ] R2 bucket created (`resume-uploads`)
- [ ] Environment secrets set:
  - [ ] `JWT_SECRET`
  - [ ] `JWT_EXPIRE`
  - [ ] `FRONTEND_URL` (update after frontend deployment)
- [ ] Backend deployed with `wrangler deploy`
- [ ] Backend URL noted: `https://________________.workers.dev`

## ✅ Frontend Deployment (Cloudflare Pages)

- [ ] Repository connected to Cloudflare Pages OR build folder ready
- [ ] Build settings configured:
  - [ ] Framework: Create React App
  - [ ] Build command: `cd frontend && npm install && npm run build`
  - [ ] Build output: `frontend/build`
- [ ] Environment variable set:
  - [ ] `REACT_APP_API_URL` = `https://your-backend-url.workers.dev/api`
- [ ] Frontend deployed
- [ ] Frontend URL noted: `https://________________.pages.dev`

## ✅ Configuration

- [ ] Backend `FRONTEND_URL` secret updated with frontend URL
- [ ] Frontend `REACT_APP_API_URL` points to backend URL
- [ ] CORS configured correctly

## ✅ Testing

- [ ] Frontend loads without errors
- [ ] Can access `/api/health` endpoint
- [ ] User registration works
- [ ] User login works
- [ ] Can create jobs (if consultant/admin)
- [ ] Can upload resumes
- [ ] Can view matches
- [ ] No CORS errors in browser console

## ✅ Post-Deployment

- [ ] First admin user created
- [ ] Custom domain configured (optional)
- [ ] SSL certificates active (automatic)
- [ ] Monitoring set up (optional)

## Quick Commands Reference

### Backend
```bash
cd backend

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put JWT_EXPIRE
wrangler secret put FRONTEND_URL

# Deploy
wrangler deploy

# Test locally
wrangler dev
```

### Frontend
```bash
cd frontend

# Build locally (for testing)
REACT_APP_API_URL=https://your-backend-url.workers.dev/api npm run build

# Test build locally
npx serve -s build
```

## URLs to Note

**Backend URL**: `https://________________.workers.dev`  
**Frontend URL**: `https://________________.pages.dev`  
**API Base URL**: `https://________________.workers.dev/api`

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| CORS errors | Update `FRONTEND_URL` secret in backend |
| 404 on routes | Check `_redirects` file exists |
| API not connecting | Verify `REACT_APP_API_URL` environment variable |
| Build fails | Check build logs, verify dependencies |
| Database errors | Verify D1 database ID in `wrangler.toml` |
