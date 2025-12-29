const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all permissions
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM permissions ORDER BY resource_type, action');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's effective permissions (role + user-specific + group permissions)
router.get('/user/:user_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const userId = req.params.user_id;
    
    // Get user's role
    const userResult = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userRole = userResult.rows[0].role;

    // Get role permissions
    const rolePerms = await db.query(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = $1`,
      [userRole]
    );

    // Get user-specific permissions
    const userPerms = await db.query(
      `SELECT p.*, up.granted FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = $1`,
      [userId]
    );

    // Get user's groups
    const userGroups = await db.query(
      'SELECT group_id FROM user_groups WHERE user_id = $1',
      [userId]
    );

    // Get group permissions
    let groupPerms = [];
    if (userGroups.rows.length > 0) {
      const groupIds = userGroups.rows.map(g => g.group_id);
      const groupPermsResult = await db.query(
        `SELECT p.*, gp.granted, gp.group_id FROM permissions p
         JOIN group_permissions gp ON p.id = gp.permission_id
         WHERE gp.group_id = ANY($1)`,
        [groupIds]
      );
      groupPerms = groupPermsResult.rows;
    }

    // Combine permissions (user-specific and group permissions override role permissions)
    const allPermissions = {};
    
    // Start with role permissions
    rolePerms.rows.forEach(perm => {
      allPermissions[perm.name] = { ...perm, source: 'role', granted: true };
    });

    // Apply group permissions (override role)
    groupPerms.forEach(perm => {
      allPermissions[perm.name] = { ...perm, source: 'group', granted: perm.granted };
    });

    // Apply user-specific permissions (override everything)
    userPerms.rows.forEach(perm => {
      allPermissions[perm.name] = { ...perm, source: 'user', granted: perm.granted };
    });

    res.json({
      role: userRole,
      permissions: Object.values(allPermissions),
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group permissions
router.get('/group/:group_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, gp.granted FROM permissions p
       LEFT JOIN group_permissions gp ON p.id = gp.permission_id AND gp.group_id = $1
       ORDER BY p.resource_type, p.action`,
      [req.params.group_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching group permissions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set user permissions
router.post('/user/:user_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const userId = req.params.user_id;
    const { permissions } = req.body; // Array of { permission_id, granted }

    // Delete existing user permissions
    await db.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      for (const perm of permissions) {
        await db.query(
          'INSERT INTO user_permissions (user_id, permission_id, granted) VALUES ($1, $2, $3)',
          [userId, perm.permission_id, perm.granted !== false]
        );
      }
    }

    res.json({ message: 'User permissions updated successfully' });
  } catch (error) {
    console.error('Error setting user permissions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set group permissions
router.post('/group/:group_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const groupId = req.params.group_id;
    const { permissions } = req.body; // Array of { permission_id, granted }

    // Delete existing group permissions
    await db.query('DELETE FROM group_permissions WHERE group_id = $1', [groupId]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      for (const perm of permissions) {
        await db.query(
          'INSERT INTO group_permissions (group_id, permission_id, granted) VALUES ($1, $2, $3)',
          [groupId, perm.permission_id, perm.granted !== false]
        );
      }
    }

    res.json({ message: 'Group permissions updated successfully' });
  } catch (error) {
    console.error('Error setting group permissions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if user has permission (for middleware)
router.get('/check/:permission_name', authenticate, async (req, res) => {
  try {
    const permissionName = req.params.permission_name;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check role permission
    const rolePerm = await db.query(
      `SELECT p.id FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = $1 AND p.name = $2`,
      [userRole, permissionName]
    );

    // Check user-specific permission
    const userPerm = await db.query(
      `SELECT up.granted FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = $1 AND p.name = $2`,
      [userId, permissionName]
    );

    // Check group permissions
    const userGroups = await db.query(
      'SELECT group_id FROM user_groups WHERE user_id = $1',
      [userId]
    );

    let groupPerm = null;
    if (userGroups.rows.length > 0) {
      const groupIds = userGroups.rows.map(g => g.group_id);
      const groupPermResult = await db.query(
        `SELECT gp.granted FROM permissions p
         JOIN group_permissions gp ON p.id = gp.permission_id
         WHERE gp.group_id = ANY($1) AND p.name = $2
         ORDER BY gp.granted DESC LIMIT 1`,
        [groupIds, permissionName]
      );
      if (groupPermResult.rows.length > 0) {
        groupPerm = groupPermResult.rows[0];
      }
    }

    // User-specific permission overrides everything
    if (userPerm.rows.length > 0) {
      return res.json({ hasPermission: userPerm.rows[0].granted });
    }

    // Group permission overrides role
    if (groupPerm) {
      return res.json({ hasPermission: groupPerm.granted });
    }

    // Default to role permission
    res.json({ hasPermission: rolePerm.rows.length > 0 });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


