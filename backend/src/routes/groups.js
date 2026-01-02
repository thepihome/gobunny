/**
 * Groups routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleGroups(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // All group management requires admin role
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

  // Get all groups
  if (path === '/api/groups' && method === 'GET') {
    try {
      const groups = await query(
        env,
        `SELECT g.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as user_count
         FROM groups g
         ORDER BY g.created_at DESC`
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(groups || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching groups:', error);
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

  // Create new group
  if (path === '/api/groups' && method === 'POST') {
    try {
      const body = await request.json();
      const { name, description } = body;

      if (!name) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group name is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if group name already exists
      const existing = await queryOne(
        env,
        'SELECT id FROM groups WHERE name = ?',
        [name]
      );

      if (existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group name already exists' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Insert group
      const result = await execute(
        env,
        `INSERT INTO groups (name, description)
         VALUES (?, ?)`,
        [name, description || null]
      );

      const groupId = result.meta?.last_row_id || result.lastInsertRowid;

      // Fetch created group
      const group = await queryOne(
        env,
        `SELECT g.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as user_count
         FROM groups g
         WHERE g.id = ?`,
        [groupId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(group),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating group:', error);
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

  // Get single group with users
  const groupDetailMatch = path.match(/^\/api\/groups\/(\d+)$/);
  if (groupDetailMatch && method === 'GET') {
    try {
      const groupId = groupDetailMatch[1];

      const group = await queryOne(
        env,
        `SELECT g.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as user_count
         FROM groups g
         WHERE g.id = ?`,
        [groupId]
      );

      if (!group) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Get group members
      const users = await query(
        env,
        `SELECT u.*, ug.assigned_at
         FROM users u
         INNER JOIN user_groups ug ON u.id = ug.user_id
         WHERE ug.group_id = ?
         ORDER BY ug.assigned_at DESC`,
        [groupId]
      );

      // Remove password_hash from users
      const usersWithoutPassword = (users || []).map(u => {
        const { password_hash, ...rest } = u;
        return rest;
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            ...group,
            users: usersWithoutPassword
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching group details:', error);
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

  // Update group
  if (groupDetailMatch && method === 'PUT') {
    try {
      const groupId = groupDetailMatch[1];
      const body = await request.json();
      const { name, description } = body;

      // Check if group exists
      const existing = await queryOne(
        env,
        'SELECT * FROM groups WHERE id = ?',
        [groupId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check name uniqueness if name is being changed
      if (name && name !== existing.name) {
        const nameExists = await queryOne(
          env,
          'SELECT id FROM groups WHERE name = ? AND id != ?',
          [name, groupId]
        );

        if (nameExists) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Group name already exists' }),
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

      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description || null);
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
      updateValues.push(groupId);

      await execute(
        env,
        `UPDATE groups SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Fetch updated group
      const updated = await queryOne(
        env,
        `SELECT g.*, 
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as user_count
         FROM groups g
         WHERE g.id = ?`,
        [groupId]
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
      console.error('Error updating group:', error);
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

  // Delete group
  if (groupDetailMatch && method === 'DELETE') {
    try {
      const groupId = groupDetailMatch[1];

      // Check if group exists
      const existing = await queryOne(
        env,
        'SELECT id FROM groups WHERE id = ?',
        [groupId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Delete group (user_groups will be cascade deleted)
      await execute(
        env,
        'DELETE FROM groups WHERE id = ?',
        [groupId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Group deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting group:', error);
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

  // Add user to group
  const addUserMatch = path.match(/^\/api\/groups\/(\d+)\/users\/(\d+)$/);
  if (addUserMatch && method === 'POST') {
    try {
      const groupId = addUserMatch[1];
      const userId = addUserMatch[2];

      // Check if group exists
      const group = await queryOne(
        env,
        'SELECT id FROM groups WHERE id = ?',
        [groupId]
      );

      if (!group) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Group not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if user exists
      const userExists = await queryOne(
        env,
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );

      if (!userExists) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if user is already in group
      const existing = await queryOne(
        env,
        'SELECT id FROM user_groups WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      );

      if (existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User is already in this group' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Add user to group
      await execute(
        env,
        `INSERT INTO user_groups (group_id, user_id, assigned_at)
         VALUES (?, ?, datetime('now'))`,
        [groupId, userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'User added to group successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error adding user to group:', error);
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

  // Remove user from group
  if (addUserMatch && method === 'DELETE') {
    try {
      const groupId = addUserMatch[1];
      const userId = addUserMatch[2];

      // Check if assignment exists
      const existing = await queryOne(
        env,
        'SELECT id FROM user_groups WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User is not in this group' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Remove user from group
      await execute(
        env,
        'DELETE FROM user_groups WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'User removed from group successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error removing user from group:', error);
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
