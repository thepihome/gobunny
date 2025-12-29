const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Calculate match score between resume and job
const calculateMatchScore = (resume, job) => {
  let score = 0;
  let maxScore = 100;

  // Skills match (40 points)
  const resumeSkills = resume.skills || [];
  const requiredSkills = job.required_skills || [];
  const preferredSkills = job.preferred_skills || [];

  const requiredMatch = resumeSkills.filter(skill =>
    requiredSkills.some(rs => rs.toLowerCase() === skill.toLowerCase())
  ).length;
  const preferredMatch = resumeSkills.filter(skill =>
    preferredSkills.some(ps => ps.toLowerCase() === skill.toLowerCase())
  ).length;

  const skillsScore = Math.min(40, (requiredMatch / Math.max(requiredSkills.length, 1)) * 30 + (preferredMatch / Math.max(preferredSkills.length, 1)) * 10);
  score += skillsScore;

  // Experience match (30 points)
  if (resume.experience_years && job.experience_level) {
    const expMap = { 'entry': 0, 'junior': 1, 'mid': 3, 'senior': 5, 'executive': 10 };
    const requiredExp = expMap[job.experience_level.toLowerCase()] || 0;
    const candidateExp = resume.experience_years;

    if (candidateExp >= requiredExp) {
      score += 30;
    } else {
      score += (candidateExp / Math.max(requiredExp, 1)) * 30;
    }
  }

  // Education match (20 points) - simplified
  if (resume.education && job.description) {
    // Basic keyword matching
    const educationKeywords = ['degree', 'bachelor', 'master', 'phd', 'diploma'];
    const hasEducation = educationKeywords.some(keyword =>
      resume.education.toLowerCase().includes(keyword)
    );
    if (hasEducation) {
      score += 20;
    }
  }

  // Summary/Description match (10 points) - simplified
  if (resume.summary && job.description) {
    const summaryWords = resume.summary.toLowerCase().split(/\s+/);
    const descWords = job.description.toLowerCase().split(/\s+/);
    const commonWords = summaryWords.filter(word => descWords.includes(word));
    const matchRatio = commonWords.length / Math.max(descWords.length, 1);
    score += matchRatio * 10;
  }

  return Math.round(score);
};

// Match resume to job
router.post('/match', authenticate, async (req, res) => {
  try {
    const { resume_id, job_id } = req.body;

    // Get resume and job
    const resumeResult = await db.query('SELECT * FROM resumes WHERE id = $1', [resume_id]);
    const jobResult = await db.query('SELECT * FROM jobs WHERE id = $1', [job_id]);

    if (resumeResult.rows.length === 0 || jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Resume or job not found' });
    }

    const resume = resumeResult.rows[0];
    const job = jobResult.rows[0];

    // Check ownership
    if (resume.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'consultant') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate match score
    const matchScore = calculateMatchScore(resume, job);
    const skillsMatch = resume.skills?.filter(skill =>
      job.required_skills?.some(rs => rs.toLowerCase() === skill.toLowerCase())
    ).length || 0;

    // Check if match already exists
    const existingMatch = await db.query(
      'SELECT * FROM job_matches WHERE job_id = $1 AND resume_id = $2',
      [job_id, resume_id]
    );

    if (existingMatch.rows.length > 0) {
      // Update existing match
      const result = await db.query(
        `UPDATE job_matches SET match_score = $1, skills_match = $2, matched_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [matchScore, skillsMatch, existingMatch.rows[0].id]
      );
      return res.json(result.rows[0]);
    }

    // Create new match
    const result = await db.query(
      `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        job_id,
        resume_id,
        resume.user_id,
        matchScore,
        skillsMatch,
        resume.experience_years || 0,
        1, // education_match placeholder
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error matching resume:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get matches for a candidate
router.get('/my-matches', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT jm.*, j.title, j.company, j.location, j.employment_type, j.status as job_status,
       r.file_name, r.uploaded_at as resume_uploaded_at
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.id
       JOIN resumes r ON jm.resume_id = r.id
       WHERE jm.candidate_id = $1
       ORDER BY jm.match_score DESC, jm.matched_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all matches (consultant/admin only)
router.get('/', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const { job_id, candidate_id, status } = req.query;
    let query = `
      SELECT jm.*, j.title as job_title, j.company, u.first_name, u.last_name, u.email,
       r.file_name
      FROM job_matches jm
      JOIN jobs j ON jm.job_id = j.id
      JOIN users u ON jm.candidate_id = u.id
      JOIN resumes r ON jm.resume_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (job_id) {
      paramCount++;
      query += ` AND jm.job_id = $${paramCount}`;
      params.push(job_id);
    }

    if (candidate_id) {
      paramCount++;
      query += ` AND jm.candidate_id = $${paramCount}`;
      params.push(candidate_id);
    }

    if (status) {
      paramCount++;
      query += ` AND jm.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY jm.match_score DESC, jm.matched_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update match status (consultant/admin only)
router.put('/:id/status', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const { status, notes } = req.body;

    const result = await db.query(
      `UPDATE job_matches SET status = $1, notes = $2 WHERE id = $3 RETURNING *`,
      [status, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Auto-match all resumes for a job (admin/consultant only)
router.post('/auto-match/:job_id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const { job_id } = req.params;

    // Get job
    const jobResult = await db.query('SELECT * FROM jobs WHERE id = $1', [job_id]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = jobResult.rows[0];

    // Get all active resumes
    const resumesResult = await db.query('SELECT * FROM resumes');
    const matches = [];

    for (const resume of resumesResult.rows) {
      const matchScore = calculateMatchScore(resume, job);
      const skillsMatch = resume.skills?.filter(skill =>
        job.required_skills?.some(rs => rs.toLowerCase() === skill.toLowerCase())
      ).length || 0;

      // Check if match exists
      const existingMatch = await db.query(
        'SELECT id FROM job_matches WHERE job_id = $1 AND resume_id = $2',
        [job_id, resume.id]
      );

      if (existingMatch.rows.length > 0) {
        await db.query(
          `UPDATE job_matches SET match_score = $1, skills_match = $2, matched_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [matchScore, skillsMatch, existingMatch.rows[0].id]
        );
      } else {
        await db.query(
          `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            job_id,
            resume.id,
            resume.user_id,
            matchScore,
            skillsMatch,
            resume.experience_years || 0,
            1,
          ]
        );
      }

      matches.push({ resume_id: resume.id, match_score: matchScore });
    }

    res.json({ message: `Matched ${matches.length} resumes`, matches });
  } catch (error) {
    console.error('Error auto-matching:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


