# CORS Fix - Trailing Slash Issue

## Problem
CORS error: `The 'Access-Control-Allow-Origin' header has a value 'https://gobunny.pages.dev/' that is not equal to the supplied origin 'https://gobunny.pages.dev'`

The issue was a trailing slash mismatch between the configured frontend URL and the actual request origin.

## Solution Applied

### 1. Updated CORS Utility
- Added origin normalization (removes trailing slashes)
- CORS headers now match the actual request origin
- Supports both Request objects and origin strings

### 2. Updated Router
- Extracts origin from request headers
- Passes request object to CORS functions
- Handles preflight OPTIONS requests correctly

### 3. Updated Auth Route
- All `addCorsHeaders` calls now pass the request object
- Ensures consistent CORS headers across all responses

## Next Steps

### Update FRONTEND_URL Secret

Make sure your `FRONTEND_URL` secret is set **without** a trailing slash:

```bash
cd backend
wrangler secret put FRONTEND_URL
# Enter: https://gobunny.pages.dev  (NO trailing slash)
```

### Deploy Backend

After updating the code, deploy the backend:

```bash
cd backend
wrangler deploy
```

## How It Works Now

1. Request comes from `https://gobunny.pages.dev` (no trailing slash)
2. Backend extracts origin from `Origin` header
3. Normalizes both the request origin and configured `FRONTEND_URL` (removes trailing slashes)
4. Matches them and returns the normalized origin in CORS headers
5. Browser accepts the response ✅

## Testing

After deploying, test registration/login:
- Should work without CORS errors
- Check browser console for any remaining issues
- Verify network requests show correct CORS headers

## Files Changed

- `backend/src/utils/cors.js` - Added origin normalization
- `backend/src/router.js` - Pass request to CORS functions
- `backend/src/routes/auth.js` - Pass request to all CORS calls

