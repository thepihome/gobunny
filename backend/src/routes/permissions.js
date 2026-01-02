/**
 * Permissions routes for Cloudflare Workers
 */

import { query, queryOne } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handlePermissions(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // All permission endpoints require admin role
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

  // Get all permissions
  if (path === '/api/permissions' && method === 'GET') {
    try {
      const { searchParams } = url;
      const resourceType = searchParams.get('resource_type');
      const action = searchParams.get('action');

      let sql = 'SELECT * FROM permissions WHERE 1=1';
      const params = [];

      if (resourceType) {
        sql += ' AND resource_type = ?';
        params.push(resourceType);
      }

      if (action) {
        sql += ' AND action = ?';
        params.push(action);
      }

      sql += ' ORDER BY resource_type, action, name';

      const permissions = await query(env, sql, params);

      return addCorsHeaders(
        new Response(
          JSON.stringify(permissions || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching permissions:', error);
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

  // Get permissions for a specific role
  const rolePermissionsMatch = path.match(/^\/api\/permissions\/role\/(\w+)$/);
  if (rolePermissionsMatch && method === 'GET') {
    try {
      const role = rolePermissionsMatch[1];

      if (!['candidate', 'consultant', 'admin'].includes(role)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid role' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const permissions = await query(
        env,
        `SELECT p.*
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = ?
         ORDER BY p.resource_type, p.action, p.name`,
        [role]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(permissions || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching role permissions:', error);
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

  // Get permissions for a specific user
  const userPermissionsMatch = path.match(/^\/api\/permissions\/user\/(\d+)$/);
  if (userPermissionsMatch && method === 'GET') {
    try {
      const userId = userPermissionsMatch[1];

      // Get user's role
      const userData = await queryOne(
        env,
        'SELECT role FROM users WHERE id = ?',
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

      // Get role-based permissions
      const rolePermissions = await query(
        env,
        `SELECT p.*, 'role' as source
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = ?`,
        [userData.role]
      );

      // Get user-specific permissions (overrides)
      const userPermissions = await query(
        env,
        `SELECT p.*, up.granted, 'user' as source
         FROM permissions p
         INNER JOIN user_permissions up ON p.id = up.permission_id
         WHERE up.user_id = ?`,
        [userId]
      );

      // Get group-based permissions
      const groupPermissions = await query(
        env,
        `SELECT DISTINCT p.*, gp.granted, 'group' as source
         FROM permissions p
         INNER JOIN group_permissions gp ON p.id = gp.permission_id
         INNER JOIN user_groups ug ON gp.group_id = ug.group_id
         WHERE ug.user_id = ?`,
        [userId]
      );

      // Combine and deduplicate (user permissions override role permissions)
      const permissionMap = new Map();

      // Add role permissions first
      rolePermissions.forEach(p => {
        permissionMap.set(p.id, { ...p, granted: true });
      });

      // Override with group permissions
      groupPermissions.forEach(p => {
        permissionMap.set(p.id, { ...p, granted: p.granted === 1 || p.granted === true });
      });

      // Override with user-specific permissions
      userPermissions.forEach(p => {
        permissionMap.set(p.id, { ...p, granted: p.granted === 1 || p.granted === true });
      });

      const allPermissions = Array.from(permissionMap.values());

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            role: userData.role,
            permissions: allPermissions
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching user permissions:', error);
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

  // Get permissions for a specific group
  const groupPermissionsMatch = path.match(/^\/api\/permissions\/group\/(\d+)$/);
  if (groupPermissionsMatch && method === 'GET') {
    try {
      const groupId = groupPermissionsMatch[1];

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

      const permissions = await query(
        env,
        `SELECT p.*, gp.granted
         FROM permissions p
         INNER JOIN group_permissions gp ON p.id = gp.permission_id
         WHERE gp.group_id = ?
         ORDER BY p.resource_type, p.action, p.name`,
        [groupId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(permissions || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching group permissions:', error);
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
