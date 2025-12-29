/**
 * Groups routes for Cloudflare Workers
 */

import { addCorsHeaders } from '../utils/cors.js';

export async function handleGroups(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Groups endpoint not yet fully implemented' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

