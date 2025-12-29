/**
 * CORS utilities for Cloudflare Workers
 */

export function getCorsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Default, will be overridden
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export function handleCORS(env) {
  const headers = getCorsHeaders(env);
  return new Response(null, {
    status: 204,
    headers,
  });
}

export function addCorsHeaders(response, env) {
  const headers = getCorsHeaders(env);
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

