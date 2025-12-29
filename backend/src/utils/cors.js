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
 * Get CORS headers based on request origin
 */
export function getCorsHeaders(env, requestOrigin = null) {
  const allowedOrigin = normalizeOrigin(env.FRONTEND_URL || '*');
  
  // If we have a request origin, check if it matches (normalized)
  let origin = '*';
  if (requestOrigin) {
    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (allowedOrigin === '*' || normalizedRequestOrigin === allowedOrigin) {
      origin = normalizedRequestOrigin;
    }
  } else if (allowedOrigin !== '*') {
    origin = allowedOrigin;
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

