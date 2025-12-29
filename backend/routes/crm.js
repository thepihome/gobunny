const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get CRM interactions
router.get('/', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'admin') {
      query = `
        SELECT c.*, 
         u.first_name as consultant_first_name, u.last_name as consultant_last_name,
         c2.first_name as candidate_first_name, c2.last_name as candidate_last_name, c2.email as candidate_email
        FROM crm_contacts c
        JOIN users u ON c.consultant_id = u.id
        JOIN users c2 ON c.candidate_id = c2.id
        ORDER BY c.interaction_date DESC, c.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT c.*, 
         u.first_name as consultant_first_name, u.last_name as consultant_last_name,
         c2.first_name as candidate_first_name, c2.last_name as candidate_last_name, c2.email as candidate_email
        FROM crm_contacts c
        JOIN users u ON c.consultant_id = u.id
        JOIN users c2 ON c.candidate_id = c2.id
        WHERE c.consultant_id = $1
        ORDER BY c.interaction_date DESC, c.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching CRM interactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get CRM interactions for a candidate
router.get('/candidate/:candidate_id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    // Check if consultant has access
    if (req.user.role === 'consultant') {
      const assignmentCheck = await db.query(
        'SELECT id FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2',
        [req.user.id, req.params.candidate_id]
      );
      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await db.query(
      `SELECT c.*, 
       u.first_name as consultant_first_name, u.last_name as consultant_last_name
      FROM crm_contacts c
      JOIN users u ON c.consultant_id = u.id
      WHERE c.candidate_id = $1
      ORDER BY c.interaction_date DESC, c.created_at DESC`,
      [req.params.candidate_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching CRM interactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create CRM interaction
router.post('/', authenticate, authorize('consultant'), async (req, res) => {
  try {
    const { candidate_id, interaction_type, interaction_date, notes, follow_up_date, status } = req.body;

    // Check if candidate is assigned
    const assignmentCheck = await db.query(
      'SELECT id FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2',
      [req.user.id, candidate_id]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Candidate not assigned to you' });
    }

    const result = await db.query(
      `INSERT INTO crm_contacts (consultant_id, candidate_id, interaction_type, interaction_date, notes, follow_up_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id,
        candidate_id,
        interaction_type,
        interaction_date || new Date(),
        notes || '',
        follow_up_date || null,
        status || 'open',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating CRM interaction:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update CRM interaction
router.put('/:id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const { interaction_type, interaction_date, notes, follow_up_date, status } = req.body;

    // Check ownership
    const interactionCheck = await db.query('SELECT consultant_id FROM crm_contacts WHERE id = $1', [req.params.id]);
    if (interactionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    if (req.user.role === 'consultant' && interactionCheck.rows[0].consultant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `UPDATE crm_contacts SET interaction_type = $1, interaction_date = $2, notes = $3, 
       follow_up_date = $4, status = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [interaction_type, interaction_date, notes, follow_up_date, status, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating CRM interaction:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete CRM interaction
router.delete('/:id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const interactionCheck = await db.query('SELECT consultant_id FROM crm_contacts WHERE id = $1', [req.params.id]);
    if (interactionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    if (req.user.role === 'consultant' && interactionCheck.rows[0].consultant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM crm_contacts WHERE id = $1', [req.params.id]);
    res.json({ message: 'CRM interaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting CRM interaction:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


