/**
 * Timesheets routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleTimesheets(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get all timesheets
  if (path === '/api/timesheets' && method === 'GET') {
    try {
      let sql = `SELECT t.*, 
                 u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
                 c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
                 j.title as job_title, j.company as job_company
                 FROM timesheets t
                 LEFT JOIN users u ON t.user_id = u.id
                 LEFT JOIN users c ON t.candidate_id = c.id
                 LEFT JOIN jobs j ON t.job_id = j.id
                 WHERE 1=1`;
      const params = [];

      // Consultants can only see their own timesheets
      if (user.role === 'consultant') {
        sql += ' AND t.user_id = ?';
        params.push(user.id);
      }
      // Admins can see all timesheets

      sql += ' ORDER BY t.date DESC, t.created_at DESC';

      const timesheets = await query(env, sql, params);

      return addCorsHeaders(
        new Response(
          JSON.stringify(timesheets || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Create new timesheet
  if (path === '/api/timesheets' && method === 'POST') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const body = await request.json();
      const { candidate_id, job_id, date, hours, description } = body;

      // Validation
      if (!date || !hours) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Date and hours are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const hoursNum = parseFloat(hours);
      if (isNaN(hoursNum) || hoursNum <= 0) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Hours must be a positive number' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Insert timesheet
      const result = await execute(
        env,
        `INSERT INTO timesheets (user_id, candidate_id, job_id, date, hours, description, status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
        [
          user.id,
          candidate_id || null,
          job_id || null,
          date,
          hoursNum,
          description || null
        ]
      );

      const timesheetId = result.meta?.last_row_id || result.lastInsertRowid;

      // Fetch created timesheet with joins
      const timesheet = await queryOne(
        env,
        `SELECT t.*, 
         u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
         j.title as job_title, j.company as job_company
         FROM timesheets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN users c ON t.candidate_id = c.id
         LEFT JOIN jobs j ON t.job_id = j.id
         WHERE t.id = ?`,
        [timesheetId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(timesheet),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating timesheet:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Update timesheet
  const updateMatch = path.match(/^\/api\/timesheets\/(\d+)$/);
  if (updateMatch && method === 'PUT') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const timesheetId = updateMatch[1];
      const body = await request.json();
      const { candidate_id, job_id, date, hours, description } = body;

      // Check if timesheet exists and user has permission
      const existing = await queryOne(
        env,
        'SELECT * FROM timesheets WHERE id = ?',
        [timesheetId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Consultants can only update their own draft timesheets
      if (user.role === 'consultant' && existing.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Can't update submitted/approved timesheets
      if (existing.status !== 'draft') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Cannot update timesheet that is not in draft status' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Validation
      if (!date || !hours) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Date and hours are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const hoursNum = parseFloat(hours);
      if (isNaN(hoursNum) || hoursNum <= 0) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Hours must be a positive number' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Update timesheet
      await execute(
        env,
        `UPDATE timesheets 
         SET candidate_id = ?, job_id = ?, date = ?, hours = ?, description = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          candidate_id || null,
          job_id || null,
          date,
          hoursNum,
          description || null,
          timesheetId
        ]
      );

      // Fetch updated timesheet
      const timesheet = await queryOne(
        env,
        `SELECT t.*, 
         u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
         j.title as job_title, j.company as job_company
         FROM timesheets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN users c ON t.candidate_id = c.id
         LEFT JOIN jobs j ON t.job_id = j.id
         WHERE t.id = ?`,
        [timesheetId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(timesheet),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating timesheet:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Submit timesheet
  const submitMatch = path.match(/^\/api\/timesheets\/(\d+)\/submit$/);
  if (submitMatch && method === 'POST') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const timesheetId = submitMatch[1];

      // Check if timesheet exists
      const timesheet = await queryOne(
        env,
        'SELECT * FROM timesheets WHERE id = ?',
        [timesheetId]
      );

      if (!timesheet) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Consultants can only submit their own timesheets
      if (user.role === 'consultant' && timesheet.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Can only submit draft timesheets
      if (timesheet.status !== 'draft') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet is not in draft status' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Update status to submitted
      await execute(
        env,
        `UPDATE timesheets 
         SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [timesheetId]
      );

      // Fetch updated timesheet
      const updated = await queryOne(
        env,
        `SELECT t.*, 
         u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
         j.title as job_title, j.company as job_company
         FROM timesheets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN users c ON t.candidate_id = c.id
         LEFT JOIN jobs j ON t.job_id = j.id
         WHERE t.id = ?`,
        [timesheetId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(updated),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Approve/Reject timesheet
  const approveMatch = path.match(/^\/api\/timesheets\/(\d+)\/approve$/);
  if (approveMatch && method === 'POST') {
    const authError = authorize('admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const timesheetId = approveMatch[1];
      const body = await request.json();
      const { action } = body; // 'approve' or 'reject'

      if (!action || (action !== 'approve' && action !== 'reject')) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Action must be "approve" or "reject"' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if timesheet exists
      const timesheet = await queryOne(
        env,
        'SELECT * FROM timesheets WHERE id = ?',
        [timesheetId]
      );

      if (!timesheet) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Can only approve/reject submitted timesheets
      if (timesheet.status !== 'submitted') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet must be in submitted status' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const approvedAt = action === 'approve' ? "datetime('now')" : null;

      // Update status
      if (action === 'approve') {
        await execute(
          env,
          `UPDATE timesheets 
           SET status = ?, approved_at = datetime('now'), approved_by = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [newStatus, user.id, timesheetId]
        );
      } else {
        await execute(
          env,
          `UPDATE timesheets 
           SET status = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [newStatus, timesheetId]
        );
      }

      // Fetch updated timesheet
      const updated = await queryOne(
        env,
        `SELECT t.*, 
         u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
         j.title as job_title, j.company as job_company
         FROM timesheets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN users c ON t.candidate_id = c.id
         LEFT JOIN jobs j ON t.job_id = j.id
         WHERE t.id = ?`,
        [timesheetId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(updated),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error approving/rejecting timesheet:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Delete timesheet
  const deleteMatch = path.match(/^\/api\/timesheets\/(\d+)$/);
  if (deleteMatch && method === 'DELETE') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const timesheetId = deleteMatch[1];

      // Check if timesheet exists
      const timesheet = await queryOne(
        env,
        'SELECT * FROM timesheets WHERE id = ?',
        [timesheetId]
      );

      if (!timesheet) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Timesheet not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Consultants can only delete their own draft timesheets
      if (user.role === 'consultant' && timesheet.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Can only delete draft timesheets
      if (timesheet.status !== 'draft') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Can only delete draft timesheets' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      await execute(
        env,
        'DELETE FROM timesheets WHERE id = ?',
        [timesheetId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Timesheet deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting timesheet:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Default: endpoint not found
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}
