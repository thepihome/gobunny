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
import { handleActivityLogs } from './routes/activityLogs.js';
import { authenticate } from './middleware/auth.js';
import { getCorsHeaders, handleCORS, addCorsHeaders } from './utils/cors.js';

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Get request origin for CORS
  const requestOrigin = request.headers.get('Origin');

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleCORS(env, request);
  }

  const corsHeaders = getCorsHeaders(env, requestOrigin);

  // API root - return available endpoints
  if (path === '/api' || path === '/api/') {
    return new Response(
      JSON.stringify({ 
        status: 'OK', 
        message: 'API is running',
        endpoints: {
          health: '/api/health',
          register: '/api/auth/register',
          login: '/api/auth/login',
          me: '/api/auth/me'
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

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

  // Database test endpoint (for debugging)
  if (path === '/api/health/db' && method === 'GET') {
    try {
      const { query } = await import('./utils/db.js');
      const tables = await query(env, "SELECT name FROM sqlite_master WHERE type='table'");
      const userCount = await query(env, 'SELECT COUNT(*) as count FROM users');
      return new Response(
        JSON.stringify({ 
          status: 'OK', 
          tables: tables.map(t => t.name),
          userCount: userCount[0]?.count || 0,
          dbConnected: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          status: 'ERROR', 
          error: error.message,
          dbConnected: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Route handlers
  try {
    // Auth routes (no authentication required)
    if (path.startsWith('/api/auth')) {
      console.log('Handling auth route:', path, method);
      try {
        const response = await handleAuth(request, env);
        if (response) {
          return addCorsHeaders(response, env, request);
        }
        // If handleAuth returns null/undefined, return 404
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Auth endpoint not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      } catch (authError) {
        console.error('Error in handleAuth:', authError);
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Auth handler error', message: authError.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
    }

    // All other routes require authentication
    const authResult = await authenticate(request, env);
    if (authResult.error) {
      console.log('Authentication failed:', authResult.error, 'for path:', path);
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

    // Route to appropriate handler
    let response;
    if (path.startsWith('/api/jobs')) {
      response = await handleJobs(request, env, user);
    } else if (path.startsWith('/api/resumes')) {
      response = await handleResumes(request, env, user);
    } else if (path.startsWith('/api/matches')) {
      response = await handleMatches(request, env, user);
    } else if (path.startsWith('/api/candidates')) {
      response = await handleCandidates(request, env, user);
    } else if (path.startsWith('/api/candidate-profiles')) {
      response = await handleCandidateProfiles(request, env, user);
    } else if (path.startsWith('/api/timesheets')) {
      response = await handleTimesheets(request, env, user);
    } else if (path.startsWith('/api/kpis')) {
      response = await handleKPIs(request, env, user);
    } else if (path.startsWith('/api/users')) {
      response = await handleUsers(request, env, user);
    } else if (path.startsWith('/api/groups')) {
      response = await handleGroups(request, env, user);
    } else if (path.startsWith('/api/permissions')) {
      response = await handlePermissions(request, env, user);
    } else if (path.startsWith('/api/crm')) {
      response = await handleCRM(request, env, user);
    } else if (path.startsWith('/api/activity-logs')) {
      response = await handleActivityLogs(request, env, user);
    } else {
      response = new Response(
        JSON.stringify({ error: 'Not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    return addCorsHeaders(response, env, request);
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

