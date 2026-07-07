/**
 * API endpoint catalog for Settings UI and integrations.
 */

import { addCorsHeaders } from '../utils/cors.js';
import { buildEndpointsPayload } from '../utils/apiCatalog.js';

export async function handleEndpoints(request, env) {
  if (request.method !== 'GET') {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      request
    );
  }

  const payload = buildEndpointsPayload(request, env);
  return addCorsHeaders(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    env,
    request
  );
}
