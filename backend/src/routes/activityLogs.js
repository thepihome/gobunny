/**
 * Activity Logs routes for Cloudflare Workers
 */

import { query } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleActivityLogs(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get activity logs for an entity
  // GET /api/activity-logs?entity_type=candidate_profile&entity_id=123
  if (path === '/api/activity-logs' && method === 'GET') {
    // Only consultants and admins can view activity logs
    const authCheck = authorize('consultant', 'admin')(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const { searchParams } = url;
      const entityType = searchParams.get('entity_type');
      const entityId = searchParams.get('entity_id');
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');
      const search = searchParams.get('search');
      const dateFrom = searchParams.get('date_from');
      const dateTo = searchParams.get('date_to');
      const action = searchParams.get('action');

      let sql = `
        SELECT 
          al.*,
          u.first_name || ' ' || u.last_name as user_name,
          u.email as user_email
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (entityType) {
        sql += ' AND al.entity_type = ?';
        params.push(entityType);
      }

      if (entityId) {
        sql += ' AND al.entity_id = ?';
        params.push(entityId);
      }

      // Debug logging
      console.log('Activity logs query:', {
        entityType,
        entityId,
        search,
        dateFrom,
        dateTo,
        action,
        limit,
        offset
      });

      if (action) {
        sql += ' AND al.action = ?';
        params.push(action);
      }

      if (search) {
        sql += ' AND (al.description LIKE ? OR al.field_name LIKE ? OR u.first_name || \' \' || u.last_name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (dateFrom) {
        sql += ' AND DATE(al.created_at) >= DATE(?)';
        params.push(dateFrom);
      }

      if (dateTo) {
        sql += ' AND DATE(al.created_at) <= DATE(?)';
        params.push(dateTo);
      }

      sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const logs = await query(env, sql, params);

      // Parse metadata JSON if present
      const parsedLogs = logs.map(log => {
        if (log.metadata && typeof log.metadata === 'string') {
          try {
            log.metadata = JSON.parse(log.metadata);
          } catch (e) {
            log.metadata = null;
          }
        }
        return log;
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify(parsedLogs),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Not found
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

