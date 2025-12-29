const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, phone, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single user (admin can get any user, users can get their own)
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Non-admin users can only access their own profile
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, phone, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user groups (only for admin or own profile)
    const groupsResult = await db.query(
      `SELECT g.id, g.name, g.description
       FROM groups g
       JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1`,
      [req.params.id]
    );

    res.json({
      ...result.rows[0],
      groups: groupsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, phone } = req.body;

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, phone, is_active`,
      [email, password_hash, first_name, last_name, role, phone]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user (admin can update any user, users can update their own profile)
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Non-admin users can only update their own profile and cannot change role or is_active
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, first_name, last_name, role, phone, is_active } = req.body;

    // Non-admin users cannot change role or is_active
    if (req.user.role !== 'admin') {
      const result = await db.query(
        `UPDATE users SET email = $1, first_name = $2, last_name = $3, phone = $4,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING id, email, first_name, last_name, role, phone, is_active`,
        [email, first_name, last_name, phone, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result.rows[0]);
    }

    // Admin can update all fields
    const result = await db.query(
      `UPDATE users SET email = $1, first_name = $2, last_name = $3, role = $4, phone = $5,
       is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING id, email, first_name, last_name, role, phone, is_active`,
      [email, first_name, last_name, role, phone, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update password (admin can update any user's password, users can update their own)
router.put('/:id/password', authenticate, async (req, res) => {
  try {
    // Non-admin users can only update their own password
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [password_hash, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

