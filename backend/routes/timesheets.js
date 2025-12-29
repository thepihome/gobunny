const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get timesheets
router.get('/', authenticate, async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'admin') {
      // Admins can see all timesheets
      query = `
        SELECT t.*, u.first_name, u.last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name,
         j.title as job_title
        FROM timesheets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users c ON t.candidate_id = c.id
        LEFT JOIN jobs j ON t.job_id = j.id
        ORDER BY t.date DESC, t.created_at DESC
      `;
      params = [];
    } else if (req.user.role === 'consultant') {
      // Consultants see their own timesheets
      query = `
        SELECT t.*, u.first_name, u.last_name, u.email as user_email,
         c.first_name as candidate_first_name, c.last_name as candidate_last_name,
         j.title as job_title
        FROM timesheets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users c ON t.candidate_id = c.id
        LEFT JOIN jobs j ON t.job_id = j.id
        WHERE t.user_id = $1
        ORDER BY t.date DESC, t.created_at DESC
      `;
      params = [req.user.id];
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single timesheet
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.first_name, u.last_name, u.email as user_email,
       c.first_name as candidate_first_name, c.last_name as candidate_last_name,
       j.title as job_title
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users c ON t.candidate_id = c.id
       LEFT JOIN jobs j ON t.job_id = j.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    const timesheet = result.rows[0];

    // Check permissions
    if (req.user.role === 'consultant' && timesheet.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(timesheet);
  } catch (error) {
    console.error('Error fetching timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create timesheet (consultant only)
router.post('/', authenticate, authorize('consultant'), async (req, res) => {
  try {
    const { candidate_id, job_id, date, hours, description } = req.body;

    // Validate candidate assignment if provided
    if (candidate_id) {
      const assignmentCheck = await db.query(
        'SELECT id FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2',
        [req.user.id, candidate_id]
      );
      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Candidate not assigned to you' });
      }
    }

    const result = await db.query(
      `INSERT INTO timesheets (user_id, candidate_id, job_id, date, hours, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, candidate_id || null, job_id || null, date, hours, description || '', 'draft']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update timesheet
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { candidate_id, job_id, date, hours, description, status } = req.body;

    // Check ownership/permissions
    const timesheetCheck = await db.query('SELECT user_id, status FROM timesheets WHERE id = $1', [req.params.id]);
    if (timesheetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    const timesheet = timesheetCheck.rows[0];

    if (req.user.role === 'consultant' && timesheet.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow status change if admin or if submitting own timesheet
    let updateStatus = timesheet.status;
    if (status && (req.user.role === 'admin' || (req.user.role === 'consultant' && status === 'submitted'))) {
      updateStatus = status;
    }

    const result = await db.query(
      `UPDATE timesheets SET candidate_id = $1, job_id = $2, date = $3, hours = $4, 
       description = $5, status = $6, updated_at = CURRENT_TIMESTAMP,
       submitted_at = CASE WHEN $6 = 'submitted' AND submitted_at IS NULL THEN CURRENT_TIMESTAMP ELSE submitted_at END
       WHERE id = $7 RETURNING *`,
      [candidate_id, job_id, date, hours, description, updateStatus, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit timesheet
router.post('/:id/submit', authenticate, authorize('consultant'), async (req, res) => {
  try {
    const timesheetCheck = await db.query('SELECT user_id FROM timesheets WHERE id = $1', [req.params.id]);
    if (timesheetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    if (timesheetCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `UPDATE timesheets SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve/reject timesheet (admin only)
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';

    const result = await db.query(
      `UPDATE timesheets SET status = $1, approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
       approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE NULL END
       WHERE id = $3 RETURNING *`,
      [status, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete timesheet
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const timesheetCheck = await db.query('SELECT user_id, status FROM timesheets WHERE id = $1', [req.params.id]);
    if (timesheetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    const timesheet = timesheetCheck.rows[0];

    if (req.user.role === 'consultant' && timesheet.user_id !== req.user.id && timesheet.status !== 'draft') {
      return res.status(403).json({ error: 'Can only delete draft timesheets' });
    }

    await db.query('DELETE FROM timesheets WHERE id = $1', [req.params.id]);
    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting timesheet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


