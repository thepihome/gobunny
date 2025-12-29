const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get user's KPIs
router.get('/my-kpis', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT k.*, 
       (SELECT json_agg(kv ORDER BY kv.date_recorded DESC)
        FROM kpi_values kv 
        WHERE kv.kpi_id = k.id 
        LIMIT 10) as recent_values
       FROM kpis k
       WHERE k.user_id = $1 AND k.is_active = true
       ORDER BY k.display_order, k.created_at DESC`,
      [req.user.id]
    );

    // Calculate current values for each KPI
    const kpisWithValues = await Promise.all(
      result.rows.map(async (kpi) => {
        let currentValue = null;

        try {
          switch (kpi.metric_type) {
            case 'total_jobs':
              const jobsResult = await db.query('SELECT COUNT(*) as count FROM jobs WHERE status = $1', ['active']);
              currentValue = parseInt(jobsResult.rows[0].count);
              break;

            case 'total_matches':
              const matchesResult = await db.query(
                'SELECT COUNT(*) as count FROM job_matches WHERE candidate_id = $1',
                [req.user.id]
              );
              currentValue = parseInt(matchesResult.rows[0].count);
              break;

            case 'average_match_score':
              const avgScoreResult = await db.query(
                'SELECT AVG(match_score) as avg FROM job_matches WHERE candidate_id = $1',
                [req.user.id]
              );
              currentValue = parseFloat(avgScoreResult.rows[0].avg || 0).toFixed(2);
              break;

            case 'total_resumes':
              const resumesResult = await db.query(
                'SELECT COUNT(*) as count FROM resumes WHERE user_id = $1',
                [req.user.id]
              );
              currentValue = parseInt(resumesResult.rows[0].count);
              break;

            case 'assigned_candidates':
              if (req.user.role === 'consultant') {
                const candidatesResult = await db.query(
                  'SELECT COUNT(*) as count FROM consultant_assignments WHERE consultant_id = $1',
                  [req.user.id]
                );
                currentValue = parseInt(candidatesResult.rows[0].count);
              }
              break;

            case 'pending_timesheets':
              if (req.user.role === 'consultant') {
                const timesheetsResult = await db.query(
                  "SELECT COUNT(*) as count FROM timesheets WHERE user_id = $1 AND status = 'draft'",
                  [req.user.id]
                );
                currentValue = parseInt(timesheetsResult.rows[0].count);
              }
              break;

            case 'total_users':
              if (req.user.role === 'admin') {
                const usersResult = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
                currentValue = parseInt(usersResult.rows[0].count);
              }
              break;

            default:
              currentValue = null;
          }

          // Store current value
          if (currentValue !== null) {
            await db.query(
              'INSERT INTO kpi_values (kpi_id, value, date_recorded) VALUES ($1, $2, CURRENT_DATE)',
              [kpi.id, currentValue]
            );
          }
        } catch (error) {
          console.error(`Error calculating KPI ${kpi.id}:`, error);
        }

        return {
          ...kpi,
          current_value: currentValue,
        };
      })
    );

    res.json(kpisWithValues);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create KPI
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, metric_type, display_order } = req.body;

    const result = await db.query(
      `INSERT INTO kpis (user_id, name, description, metric_type, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, description || '', metric_type, display_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating KPI:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update KPI
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, metric_type, display_order, is_active } = req.body;

    // Check ownership
    const kpiCheck = await db.query('SELECT user_id FROM kpis WHERE id = $1', [req.params.id]);
    if (kpiCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    if (kpiCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `UPDATE kpis SET name = $1, description = $2, metric_type = $3, display_order = $4, 
       is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [name, description, metric_type, display_order, is_active !== undefined ? is_active : true, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating KPI:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete KPI
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const kpiCheck = await db.query('SELECT user_id FROM kpis WHERE id = $1', [req.params.id]);
    if (kpiCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    if (kpiCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM kpis WHERE id = $1', [req.params.id]);
    res.json({ message: 'KPI deleted successfully' });
  } catch (error) {
    console.error('Error deleting KPI:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available metric types
router.get('/metric-types', authenticate, async (req, res) => {
  const metricTypes = [
    { value: 'total_jobs', label: 'Total Active Jobs', roles: ['candidate', 'consultant', 'admin'] },
    { value: 'total_matches', label: 'Total Matches', roles: ['candidate'] },
    { value: 'average_match_score', label: 'Average Match Score', roles: ['candidate'] },
    { value: 'total_resumes', label: 'Total Resumes', roles: ['candidate'] },
    { value: 'assigned_candidates', label: 'Assigned Candidates', roles: ['consultant'] },
    { value: 'pending_timesheets', label: 'Pending Timesheets', roles: ['consultant'] },
    { value: 'total_users', label: 'Total Users', roles: ['admin'] },
    { value: 'total_candidates', label: 'Total Candidates', roles: ['admin', 'consultant'] },
  ];

  const availableTypes = metricTypes.filter(mt => mt.roles.includes(req.user.role));
  res.json(availableTypes);
});

module.exports = router;


