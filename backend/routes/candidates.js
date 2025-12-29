const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get assigned candidates (for consultants)
router.get('/assigned', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at,
       ca.assigned_at, ca.status as assignment_status,
       COUNT(DISTINCT r.id) as resume_count,
       COUNT(DISTINCT jm.id) as match_count,
       cp.current_job_title, cp.current_company, cp.years_of_experience, cp.availability
       FROM consultant_assignments ca
       JOIN users u ON ca.candidate_id = u.id
       LEFT JOIN resumes r ON u.id = r.user_id
       LEFT JOIN job_matches jm ON u.id = jm.candidate_id
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE ca.consultant_id = $1
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at, ca.assigned_at, ca.status,
                cp.current_job_title, cp.current_company, cp.years_of_experience, cp.availability
       ORDER BY ca.assigned_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assigned candidates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all candidates (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.is_active, u.created_at,
       COUNT(DISTINCT r.id) as resume_count,
       COUNT(DISTINCT jm.id) as match_count,
       cp.current_job_title, cp.current_company, cp.years_of_experience, cp.availability
       FROM users u
       LEFT JOIN resumes r ON u.id = r.user_id
       LEFT JOIN job_matches jm ON u.id = jm.candidate_id
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE u.role = 'candidate'
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.is_active, u.created_at,
                cp.current_job_title, cp.current_company, cp.years_of_experience, cp.availability
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get candidate details
router.get('/:id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    // Check if consultant has access to this candidate
    if (req.user.role === 'consultant') {
      const assignmentCheck = await db.query(
        'SELECT id FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2',
        [req.user.id, req.params.id]
      );
      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, phone, created_at FROM users WHERE id = $1 AND role = $2',
      [req.params.id, 'candidate']
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = userResult.rows[0];

    // Get resumes
    const resumesResult = await db.query(
      'SELECT * FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );

    // Get matches
    const matchesResult = await db.query(
      `SELECT jm.*, j.title, j.company, j.location, j.status as job_status
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.id
       WHERE jm.candidate_id = $1
       ORDER BY jm.match_score DESC`,
      [req.params.id]
    );

    // Get CRM interactions
    const crmResult = await db.query(
      'SELECT * FROM crm_contacts WHERE candidate_id = $1 ORDER BY interaction_date DESC',
      [req.params.id]
    );

    // Get candidate profile
    const profileResult = await db.query(
      'SELECT * FROM candidate_profiles WHERE user_id = $1',
      [req.params.id]
    );

    res.json({
      ...candidate,
      resumes: resumesResult.rows,
      matches: matchesResult.rows,
      crm_interactions: crmResult.rows,
      profile: profileResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Error fetching candidate details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign candidate to consultant (admin only)
router.post('/:id/assign', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { consultant_id } = req.body;
    const candidate_id = req.params.id;

    // Verify consultant exists
    const consultantCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)',
      [consultant_id, 'consultant', 'admin']
    );
    if (consultantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Consultant not found' });
    }

    // Check if already assigned
    const existingAssignment = await db.query(
      'SELECT id FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2',
      [consultant_id, candidate_id]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ error: 'Candidate already assigned to this consultant' });
    }

    const result = await db.query(
      'INSERT INTO consultant_assignments (consultant_id, candidate_id) VALUES ($1, $2) RETURNING *',
      [consultant_id, candidate_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning candidate:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unassign candidate from consultant (admin only)
router.delete('/:id/assign/:consultant_id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM consultant_assignments WHERE consultant_id = $1 AND candidate_id = $2 RETURNING id',
      [req.params.consultant_id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Candidate unassigned successfully' });
  } catch (error) {
    console.error('Error unassigning candidate:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

