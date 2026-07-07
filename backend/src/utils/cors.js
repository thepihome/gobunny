/**
 * CORS utilities for Cloudflare Workers
 */

/**
 * Normalize URL by removing trailing slash
 */
function normalizeOrigin(origin) {
  if (!origin) return origin;
  return origin.replace(/\/$/, '');
}

/**
 * Allowed origins from FRONTEND_URL and/or comma-separated FRONTEND_URLS.
 * Example: FRONTEND_URLS=https://gobunny.pages.dev,https://godash.gobunnyy.com
 */
export function getAllowedOrigins(env) {
  const raw = [
    env.FRONTEND_URLS,
    env.FRONTEND_URL,
    env.CAREERS_SITE_URLS,
    env.CORS_EXTRA_ORIGINS,
  ]
    .filter(Boolean)
    .join(',');
  if (!raw || raw.trim() === '*') return ['*'];

  const origins = new Set();
  raw.split(',').forEach((entry) => {
    const normalized = normalizeOrigin(entry.trim());
    if (normalized) origins.add(normalized);
  });

  return origins.size > 0 ? [...origins] : ['*'];
}

function wildcardToRegex(pattern) {
  const parts = pattern.split('*').map((part) =>
    part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  );
  return new RegExp(`^${parts.join('[^.]+')}$`);
}

function isOriginAllowed(allowedOrigins, requestOrigin) {
  if (allowedOrigins.includes('*')) return true;
  if (!requestOrigin) return false;
  const normalized = normalizeOrigin(requestOrigin);
  if (allowedOrigins.includes(normalized)) return true;
  return allowedOrigins.some(
    (pattern) => pattern.includes('*') && wildcardToRegex(pattern).test(normalized)
  );
}

/**
 * Get CORS headers based on request origin
 */
export function getCorsHeaders(env, requestOrigin = null) {
  const allowedOrigins = getAllowedOrigins(env);

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (requestOrigin && isOriginAllowed(allowedOrigins, requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = normalizeOrigin(requestOrigin);
    headers['Access-Control-Allow-Credentials'] = 'true';
    return headers;
  }

  if (
    !requestOrigin &&
    !allowedOrigins.includes('*') &&
    allowedOrigins.length === 1 &&
    !allowedOrigins[0].includes('*')
  ) {
    headers['Access-Control-Allow-Origin'] = allowedOrigins[0];
    headers['Access-Control-Allow-Credentials'] = 'true';
    return headers;
  }

  if (allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  // Disallowed origin — omit ACAO/credentials (browser blocks cross-origin)
  return headers;
}

/**
 * Get origin from request (supports both Request object and string)
 */
function getOriginFromRequest(request) {
  if (typeof request === 'string') {
    return request;
  }
  if (request && typeof request === 'object' && 'headers' in request) {
    return request.headers.get('Origin');
  }
  return null;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Default, will be overridden
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export function handleCORS(env, requestOrOrigin = null) {
  const requestOrigin = getOriginFromRequest(requestOrOrigin);
  const headers = getCorsHeaders(env, requestOrigin);
  return new Response(null, {
    status: 204,
    headers,
  });
}

export function addCorsHeaders(response, env, requestOrOrigin = null) {
  const requestOrigin = getOriginFromRequest(requestOrOrigin);
  const headers = getCorsHeaders(env, requestOrigin);
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
