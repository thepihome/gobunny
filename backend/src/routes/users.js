/**
 * Users routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

/**
 * Hash password using Web Crypto API (PBKDF2) - same as auth.js
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleUsers(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // All user management endpoints require admin role
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

  // Get all users
  if (path === '/api/users' && method === 'GET') {
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
          JSON.stringify(users || []),
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

  // Create new user
  if (path === '/api/users' && method === 'POST') {
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

      // Remove password_hash from response
      delete newUser.password_hash;

      return addCorsHeaders(
        new Response(
          JSON.stringify(newUser),
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

  // Get single user with details
  const userDetailMatch = path.match(/^\/api\/users\/(\d+)$/);
  if (userDetailMatch && method === 'GET') {
    try {
      const userId = userDetailMatch[1];

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

      // Remove password_hash
      delete userData.password_hash;

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            ...userData,
            groups: groups || []
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

  // Update user
  if (userDetailMatch && method === 'PUT') {
    try {
      const userId = userDetailMatch[1];
      const body = await request.json();
      const { email, first_name, last_name, role, phone, is_active } = body;

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

      delete updated.password_hash;

      return addCorsHeaders(
        new Response(
          JSON.stringify(updated),
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

  // Update user password
  const passwordMatch = path.match(/^\/api\/users\/(\d+)\/password$/);
  if (passwordMatch && method === 'PUT') {
    try {
      const userId = passwordMatch[1];
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

  // Delete user
  if (userDetailMatch && method === 'DELETE') {
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
