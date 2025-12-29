const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all groups (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*, COUNT(ug.user_id) as user_count
       FROM groups g
       LEFT JOIN user_groups ug ON g.id = ug.group_id
       GROUP BY g.id
       ORDER BY g.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single group
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const groupResult = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const usersResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, ug.assigned_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = $1
       ORDER BY ug.assigned_at DESC`,
      [req.params.id]
    );

    res.json({
      ...groupResult.rows[0],
      users: usersResult.rows,
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await db.query(
      'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await db.query(
      'UPDATE groups SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM groups WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add user to group (admin only)
router.post('/:id/users/:user_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'INSERT INTO user_groups (group_id, user_id) VALUES ($1, $2) RETURNING *',
      [req.params.id, req.params.user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'User already in group' });
    }
    console.error('Error adding user to group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove user from group (admin only)
router.delete('/:id/users/:user_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.params.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not in group' });
    }

    res.json({ message: 'User removed from group successfully' });
  } catch (error) {
    console.error('Error removing user from group:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


