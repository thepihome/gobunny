/**
 * Users routes for Cloudflare Workers
 */

import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleUsers(request, env, user) {
  const authError = authorize('admin')(user);
  if (authError) {
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: authError.error }),
        { status: authError.status, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Users endpoint not yet fully implemented' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    )
  );
}

