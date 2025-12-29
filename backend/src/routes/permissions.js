/**
 * Permissions routes for Cloudflare Workers
 */

import { addCorsHeaders } from '../utils/cors.js';

export async function handlePermissions(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Permissions endpoint not yet fully implemented' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    )
  );
}

