const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/resumes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resume-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'));
    }
  },
});

// Upload resume
router.post('/upload', authenticate, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { skills, experience_years, education, summary } = req.body;

    // In a real application, you would parse the resume file to extract text
    // For now, we'll just store the file path
    const result = await db.query(
      `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, skills, experience_years, education, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.user.id,
        req.file.path,
        req.file.originalname,
        req.file.size,
        '', // content_text would be extracted from file
        skills ? JSON.parse(skills) : [],
        experience_years ? parseInt(experience_years) : null,
        education || '',
        summary || '',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's resumes
router.get('/my-resumes', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all resumes (consultant/admin only)
router.get('/', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.first_name, u.last_name, u.email 
       FROM resumes r 
       JOIN users u ON r.user_id = u.id 
       ORDER BY r.uploaded_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single resume
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.first_name, u.last_name, u.email 
       FROM resumes r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Check permissions
    const resume = result.rows[0];
    if (req.user.role === 'candidate' && resume.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(resume);
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update resume
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { skills, experience_years, education, summary } = req.body;

    // Check ownership
    const resumeCheck = await db.query('SELECT user_id FROM resumes WHERE id = $1', [req.params.id]);
    if (resumeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (resumeCheck.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `UPDATE resumes SET skills = $1, experience_years = $2, education = $3, summary = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [skills || [], experience_years, education, summary, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Configure multer for candidate resume uploads (admin only)
const candidateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads/resumes');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const candidateId = req.params.candidate_id;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `resume-candidate-${candidateId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'));
    }
  },
});

// Upload resume for a candidate (admin only)
router.post('/upload-for-candidate/:candidate_id', authenticate, authorize('admin'), candidateUpload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const candidateId = req.params.candidate_id;
    const { skills, experience_years, education, summary } = req.body;

    // Check if candidate exists
    const candidateCheck = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [candidateId, 'candidate']);
    if (candidateCheck.rows.length === 0) {
      // Delete uploaded file if candidate doesn't exist
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Check resume count limit (max 3)
    const resumeCount = await db.query('SELECT COUNT(*) as count FROM resumes WHERE user_id = $1', [candidateId]);
    if (parseInt(resumeCount.rows[0].count) >= 3) {
      // Delete uploaded file if limit reached
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Maximum of 3 resumes allowed per candidate' });
    }

    // Store relative path for easier serving
    const relativePath = req.file.path.replace(path.join(__dirname, '../'), '');

    // Insert resume
    const result = await db.query(
      `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, skills, experience_years, education, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        candidateId,
        relativePath,
        req.file.originalname,
        req.file.size,
        '', // content_text would be extracted from file
        skills ? (Array.isArray(skills) ? skills : JSON.parse(skills)) : [],
        experience_years ? parseInt(experience_years) : null,
        education || '',
        summary || '',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading resume for candidate:', error);
    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get candidate's resume count
router.get('/count/:candidate_id', authenticate, authorize('admin', 'consultant'), async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM resumes WHERE user_id = $1', [req.params.candidate_id]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching resume count:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete resume
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const resumeCheck = await db.query('SELECT user_id, file_path FROM resumes WHERE id = $1', [req.params.id]);
    if (resumeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (resumeCheck.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file
    if (resumeCheck.rows[0].file_path && fs.existsSync(resumeCheck.rows[0].file_path)) {
      fs.unlinkSync(resumeCheck.rows[0].file_path);
    }

    await db.query('DELETE FROM resumes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

