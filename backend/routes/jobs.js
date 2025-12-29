const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all jobs (with filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search, location, employment_type, include_deleted } = req.query;
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // By default, exclude deleted jobs unless explicitly requested
    if (include_deleted !== 'true') {
      query += ` AND status != 'deleted'`;
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount} OR company ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (location) {
      paramCount++;
      query += ` AND location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
    }

    if (employment_type) {
      paramCount++;
      query += ` AND employment_type = $${paramCount}`;
      params.push(employment_type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single job
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create job (consultant/admin only)
router.post('/', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      company,
      location,
      salary_min,
      salary_max,
      employment_type,
      required_skills,
      preferred_skills,
      experience_level,
      external_apply_link,
      status,
    } = req.body;

    const result = await db.query(
      `INSERT INTO jobs (title, description, company, location, salary_min, salary_max,
       employment_type, required_skills, preferred_skills, experience_level, external_apply_link, status, posted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title,
        description,
        company,
        location,
        salary_min,
        salary_max,
        employment_type,
        required_skills || [],
        preferred_skills || [],
        experience_level,
        external_apply_link || null,
        status || 'active',
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update job (consultant/admin only)
router.put('/:id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      company,
      location,
      salary_min,
      salary_max,
      employment_type,
      required_skills,
      preferred_skills,
      experience_level,
      external_apply_link,
      status,
    } = req.body;

    const result = await db.query(
      `UPDATE jobs SET title = $1, description = $2, company = $3, location = $4,
       salary_min = $5, salary_max = $6, employment_type = $7, required_skills = $8,
       preferred_skills = $9, experience_level = $10, external_apply_link = $11, status = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [
        title,
        description,
        company,
        location,
        salary_min,
        salary_max,
        employment_type,
        required_skills,
        preferred_skills,
        experience_level,
        external_apply_link || null,
        status,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Soft delete job (consultant/admin only)
router.delete('/:id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
      ['deleted', req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully', job: result.rows[0] });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

