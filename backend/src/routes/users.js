/**
 * Users routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize, isSelfOrAdmin } from '../middleware/auth.js';
import { hashPassword } from '../utils/crypto.js';
import { queueTransactionalEmail } from '../utils/emailService.js';

function sanitizeUser(row) {
  if (!row) return row;
  const { password_hash, ...safe } = row;
  return safe;
}

function sanitizeUsers(rows) {
  return (rows || []).map(sanitizeUser);
}

function forbiddenResponse(env, request, message = 'Insufficient permissions') {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: message }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

export async function handleUsers(request, env, user, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const userDetailMatch = path.match(/^\/api\/users\/(\d+)$/);
  const passwordMatch = path.match(/^\/api\/users\/(\d+)\/password$/);
  const userActivityMatch = path.match(/^\/api\/users\/(\d+)\/activity$/);

  // Get all users (admin only)
  if (path === '/api/users' && method === 'GET') {
    const authError = authorize('admin')(user);
    if (authError) return forbiddenResponse(env, request, authError.error);
    try {
      const users = await query(
        env,
        `SELECT u.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.user_id = u.id) as group_count
         FROM users u
         ORDER BY u.created_at DESC`
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(sanitizeUsers(users)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching users:', error);
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

  // Create new user (admin only)
  if (path === '/api/users' && method === 'POST') {
    const authError = authorize('admin')(user);
    if (authError) return forbiddenResponse(env, request, authError.error);
    try {
      const body = await request.json();
      const { email, password, first_name, last_name, role, phone, is_active } = body;

      // Validation
      if (!email || !password || !first_name || !last_name || !role) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Email, password, first_name, last_name, and role are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (!['candidate', 'consultant', 'admin'].includes(role)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid role. Must be candidate, consultant, or admin' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if email already exists
      const existing = await queryOne(
        env,
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Email already exists' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user
      const result = await execute(
        env,
        `INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          email,
          passwordHash,
          first_name,
          last_name,
          role,
          phone || null,
          is_active !== undefined ? (is_active ? 1 : 0) : 1
        ]
      );

      const userId = result.meta?.last_row_id || result.lastInsertRowid;

      // If candidate, create candidate profile
      if (role === 'candidate') {
        try {
          await execute(
            env,
            'INSERT INTO candidate_profiles (user_id) VALUES (?)',
            [userId]
          );
        } catch (e) {
          console.error('Error creating candidate profile:', e);
          // Continue even if profile creation fails
        }
      }

      // Fetch created user
      const newUser = await queryOne(
        env,
        `SELECT u.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.user_id = u.id) as group_count
         FROM users u
         WHERE u.id = ?`,
        [userId]
      );

      const emailVars = {
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
      };
      if (role === 'candidate') {
        queueTransactionalEmail(ctx, env, 'candidate_onboarded', newUser.email, emailVars);
      } else {
        queueTransactionalEmail(ctx, env, 'user_created', newUser.email, emailVars);
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(sanitizeUser(newUser)),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating user:', error);
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

  // User activity timeline (admin only)
  if (userActivityMatch && method === 'GET') {
    const authError = authorize('admin')(user);
    if (authError) return forbiddenResponse(env, request, authError.error);
    try {
      const targetUserId = parseInt(userActivityMatch[1], 10);
      const { searchParams } = url;
      const search = searchParams.get('search');
      const dateFrom = searchParams.get('date_from');
      const dateTo = searchParams.get('date_to');
      const action = searchParams.get('action');
      const kind = searchParams.get('kind') || 'all';
      const limit = Math.min(parseInt(searchParams.get('limit') || '150', 10), 300);

      const targetUser = await queryOne(
        env,
        'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
        [targetUserId]
      );

      if (!targetUser) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const items = [];

      const pushLog = (log) => {
        if (log.metadata && typeof log.metadata === 'string') {
          try {
            log.metadata = JSON.parse(log.metadata);
          } catch {
            log.metadata = null;
          }
        }
        items.push({
          id: `log-${log.id}`,
          kind: 'activity_log',
          action: log.action,
          description: log.description,
          field_name: log.field_name,
          old_value: log.old_value,
          new_value: log.new_value,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          user_id: log.user_id,
          user_name: log.user_name,
          created_at: log.created_at,
          sort_at: log.created_at,
        });
      };

      const pushCrm = (row) => {
        items.push({
          id: `crm-${row.id}`,
          kind: 'crm',
          action: row.interaction_type,
          description: row.notes,
          status: row.status,
          consultant_id: row.consultant_id,
          consultant_name: [row.consultant_first_name, row.consultant_last_name].filter(Boolean).join(' ').trim(),
          candidate_id: row.candidate_id,
          candidate_name: [row.candidate_first_name, row.candidate_last_name].filter(Boolean).join(' ').trim(),
          follow_up_date: row.follow_up_date,
          interaction_date: row.interaction_date,
          created_at: row.created_at,
          sort_at: row.interaction_date || row.created_at,
        });
      };

      const logFilters = [];
      const logParams = [];
      const crmFilters = [];
      const crmParams = [];

      if (search) {
        const term = `%${search}%`;
        logFilters.push('(al.description LIKE ? OR al.field_name LIKE ? OR u.first_name || \' \' || u.last_name LIKE ?)');
        logParams.push(term, term, term);
        crmFilters.push('(c.notes LIKE ? OR u.first_name || \' \' || u.last_name LIKE ? OR c2.first_name || \' \' || c2.last_name LIKE ?)');
        crmParams.push(term, term, term);
      }
      if (action) {
        logFilters.push('al.action = ?');
        logParams.push(action);
      }
      if (dateFrom) {
        logFilters.push('DATE(al.created_at) >= DATE(?)');
        logParams.push(dateFrom);
        crmFilters.push('DATE(COALESCE(c.interaction_date, c.created_at)) >= DATE(?)');
        crmParams.push(dateFrom);
      }
      if (dateTo) {
        logFilters.push('DATE(al.created_at) <= DATE(?)');
        logParams.push(dateTo);
        crmFilters.push('DATE(COALESCE(c.interaction_date, c.created_at)) <= DATE(?)');
        crmParams.push(dateTo);
      }

      const extraLogWhere = logFilters.length ? ` AND ${logFilters.join(' AND ')}` : '';
      const extraCrmWhere = crmFilters.length ? ` AND ${crmFilters.join(' AND ')}` : '';

      if (kind !== 'crm' && (targetUser.role === 'consultant' || targetUser.role === 'admin')) {
        const logs = await query(
          env,
          `SELECT al.*, u.first_name || ' ' || u.last_name as user_name
           FROM activity_logs al
           LEFT JOIN users u ON al.user_id = u.id
           WHERE al.user_id = ?${extraLogWhere}
           ORDER BY al.created_at DESC
           LIMIT ?`,
          [targetUserId, ...logParams, limit]
        );
        (logs || []).forEach(pushLog);
      }

      if (kind !== 'activity' && targetUser.role === 'consultant') {
        const crmRows = await query(
          env,
          `SELECT c.*,
                  u.first_name as consultant_first_name, u.last_name as consultant_last_name,
                  c2.first_name as candidate_first_name, c2.last_name as candidate_last_name
           FROM crm_contacts c
           LEFT JOIN users u ON c.consultant_id = u.id
           LEFT JOIN users c2 ON c.candidate_id = c2.id
           WHERE c.consultant_id = ?${extraCrmWhere}
           ORDER BY c.interaction_date DESC, c.created_at DESC
           LIMIT ?`,
          [targetUserId, ...crmParams, limit]
        );
        (crmRows || []).forEach(pushCrm);
      }

      if (targetUser.role === 'candidate') {
        if (kind !== 'crm') {
          const profile = await queryOne(
            env,
            'SELECT id FROM candidate_profiles WHERE user_id = ?',
            [targetUserId]
          );
          if (profile?.id) {
            const logs = await query(
              env,
              `SELECT al.*, u.first_name || ' ' || u.last_name as user_name
               FROM activity_logs al
               LEFT JOIN users u ON al.user_id = u.id
               WHERE al.entity_type = 'candidate_profile' AND al.entity_id = ?${extraLogWhere}
               ORDER BY al.created_at DESC
               LIMIT ?`,
              [profile.id, ...logParams, limit]
            );
            (logs || []).forEach(pushLog);
          }
        }
        if (kind !== 'activity') {
          const crmRows = await query(
            env,
            `SELECT c.*,
                    u.first_name as consultant_first_name, u.last_name as consultant_last_name,
                    c2.first_name as candidate_first_name, c2.last_name as candidate_last_name
             FROM crm_contacts c
             LEFT JOIN users u ON c.consultant_id = u.id
             LEFT JOIN users c2 ON c.candidate_id = c2.id
             WHERE c.candidate_id = ?${extraCrmWhere}
             ORDER BY c.interaction_date DESC, c.created_at DESC
             LIMIT ?`,
            [targetUserId, ...crmParams, limit]
          );
          (crmRows || []).forEach(pushCrm);
        }
      }

      items.sort((a, b) => String(b.sort_at || '').localeCompare(String(a.sort_at || '')));
      const trimmed = items.slice(0, limit);

      const activityCount = trimmed.filter((i) => i.kind === 'activity_log').length;
      const crmCount = trimmed.filter((i) => i.kind === 'crm').length;

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            user: targetUser,
            items: trimmed,
            counts: {
              activity_logs: activityCount,
              crm: crmCount,
              total: trimmed.length,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching user activity:', error);
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

  // Get single user (self or admin)
  if (userDetailMatch && method === 'GET') {
    const userId = userDetailMatch[1];
    if (!isSelfOrAdmin(user, userId)) {
      return forbiddenResponse(env, request);
    }
    try {

      const userData = await queryOne(
        env,
        `SELECT u.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.user_id = u.id) as group_count
         FROM users u
         WHERE u.id = ?`,
        [userId]
      );

      if (!userData) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Get user groups
      const groups = await query(
        env,
        `SELECT g.*, ug.assigned_at
         FROM groups g
         INNER JOIN user_groups ug ON g.id = ug.group_id
         WHERE ug.user_id = ?`,
        [userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            ...sanitizeUser(userData),
            groups: groups || [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching user details:', error);
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

  // Update user (self or admin; only admin may change role/is_active)
  if (userDetailMatch && method === 'PUT') {
    try {
      const userId = userDetailMatch[1];
      if (!isSelfOrAdmin(user, userId)) {
        return forbiddenResponse(env, request);
      }

      const body = await request.json();
      let { email, first_name, last_name, role, phone, is_active } = body;

      if (user.role !== 'admin') {
        role = undefined;
        is_active = undefined;
      }

      // Check if user exists
      const existing = await queryOne(
        env,
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Validate role if provided
      if (role && !['candidate', 'consultant', 'admin'].includes(role)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid role. Must be candidate, consultant, or admin' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check email uniqueness if email is being changed
      if (email && email !== existing.email) {
        const emailExists = await queryOne(
          env,
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );

        if (emailExists) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Email already exists' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            request
          );
        }
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];

      if (email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (first_name !== undefined) {
        updateFields.push('first_name = ?');
        updateValues.push(first_name);
      }
      if (last_name !== undefined) {
        updateFields.push('last_name = ?');
        updateValues.push(last_name);
      }
      if (role !== undefined) {
        updateFields.push('role = ?');
        updateValues.push(role);
      }
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        updateValues.push(phone || null);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(is_active ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'No fields to update' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      updateFields.push("updated_at = datetime('now')");
      updateValues.push(userId);

      await execute(
        env,
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Fetch updated user
      const updated = await queryOne(
        env,
        `SELECT u.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.user_id = u.id) as group_count
         FROM users u
         WHERE u.id = ?`,
        [userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(sanitizeUser(updated)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating user:', error);
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

  // Update user password (self or admin)
  if (passwordMatch && method === 'PUT') {
    try {
      const userId = passwordMatch[1];
      if (!isSelfOrAdmin(user, userId)) {
        return forbiddenResponse(env, request);
      }

      const body = await request.json();
      const { password } = body;

      if (!password || password.length < 6) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if user exists
      const existing = await queryOne(
        env,
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Hash new password
      const passwordHash = await hashPassword(password);

      await execute(
        env,
        `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
        [passwordHash, userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Password updated successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating password:', error);
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

  // Delete user (admin only)
  if (userDetailMatch && method === 'DELETE') {
    const authError = authorize('admin')(user);
    if (authError) return forbiddenResponse(env, request, authError.error);

    try {
      const userId = userDetailMatch[1];

      // Check if user exists
      const existing = await queryOne(
        env,
        'SELECT id, email FROM users WHERE id = ?',
        [userId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Prevent deleting yourself
      if (parseInt(userId) === user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Cannot delete your own account' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      await execute(
        env,
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'User deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting user:', error);
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
