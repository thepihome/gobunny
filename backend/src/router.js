/**
 * Main router for Cloudflare Workers
 */

import { handleAuth } from './routes/auth.js';
import { handleJobs } from './routes/jobs.js';
import { handleResumes } from './routes/resumes.js';
import { handleMatches } from './routes/matches.js';
import { handleCandidates } from './routes/candidates.js';
import { handleCandidateProfiles } from './routes/candidateProfiles.js';
import { handleTimesheets } from './routes/timesheets.js';
import { handleKPIs } from './routes/kpis.js';
import { handleUsers } from './routes/users.js';
import { handleGroups } from './routes/groups.js';
import { handlePermissions } from './routes/permissions.js';
import { handleCRM } from './routes/crm.js';
import { authenticate } from './middleware/auth.js';
import { getCorsHeaders, handleCORS } from './utils/cors.js';

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleCORS(env);
  }

  const corsHeaders = getCorsHeaders(env);

  // Health check
  if (path === '/api/health') {
    return new Response(
      JSON.stringify({ status: 'OK', message: 'Server is running' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Route handlers
  try {
    // Auth routes (no authentication required)
    if (path.startsWith('/api/auth')) {
      const response = await handleAuth(request, env);
      return addCorsHeaders(response, env);
    }

    // All other routes require authentication
    const authResult = await authenticate(request, env);
    if (authResult.error) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: authResult.status || 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Attach user to request context
    const user = authResult.user;
    const requestWithUser = { ...request, user };

    // Route to appropriate handler
    let response;
    if (path.startsWith('/api/jobs')) {
      response = await handleJobs(requestWithUser, env, user);
    } else if (path.startsWith('/api/resumes')) {
      response = await handleResumes(requestWithUser, env, user);
    } else if (path.startsWith('/api/matches')) {
      response = await handleMatches(requestWithUser, env, user);
    } else if (path.startsWith('/api/candidates')) {
      response = await handleCandidates(requestWithUser, env, user);
    } else if (path.startsWith('/api/candidate-profiles')) {
      response = await handleCandidateProfiles(requestWithUser, env, user);
    } else if (path.startsWith('/api/timesheets')) {
      response = await handleTimesheets(requestWithUser, env, user);
    } else if (path.startsWith('/api/kpis')) {
      response = await handleKPIs(requestWithUser, env, user);
    } else if (path.startsWith('/api/users')) {
      response = await handleUsers(requestWithUser, env, user);
    } else if (path.startsWith('/api/groups')) {
      response = await handleGroups(requestWithUser, env, user);
    } else if (path.startsWith('/api/permissions')) {
      response = await handlePermissions(requestWithUser, env, user);
    } else if (path.startsWith('/api/crm')) {
      response = await handleCRM(requestWithUser, env, user);
    } else {
      response = new Response(
        JSON.stringify({ error: 'Not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    return addCorsHeaders(response, env);
  } catch (error) {
    console.error('Route handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

