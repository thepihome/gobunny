const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get candidate profile
router.get('/:user_id', authenticate, authorize('consultant', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM candidate_profiles WHERE user_id = $1',
      [req.params.user_id]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update candidate profile
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      user_id,
      date_of_birth,
      address,
      city,
      state,
      country,
      zip_code,
      linkedin_url,
      portfolio_url,
      github_url,
      current_job_title,
      current_company,
      years_of_experience,
      availability,
      expected_salary_min,
      expected_salary_max,
      work_authorization,
      willing_to_relocate,
      preferred_locations,
      summary,
      additional_notes,
    } = req.body;

    // Check if profile exists
    const existing = await db.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [user_id]);

    let result;
    if (existing.rows.length > 0) {
      // Update existing profile
      result = await db.query(
        `UPDATE candidate_profiles SET 
         date_of_birth = $1, address = $2, city = $3, state = $4, country = $5, zip_code = $6,
         linkedin_url = $7, portfolio_url = $8, github_url = $9, current_job_title = $10,
         current_company = $11, years_of_experience = $12, availability = $13,
         expected_salary_min = $14, expected_salary_max = $15, work_authorization = $16,
         willing_to_relocate = $17, preferred_locations = $18, summary = $19,
         additional_notes = $20, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $21 RETURNING *`,
        [
          date_of_birth || null,
          address || null,
          city || null,
          state || null,
          country || null,
          zip_code || null,
          linkedin_url || null,
          portfolio_url || null,
          github_url || null,
          current_job_title || null,
          current_company || null,
          years_of_experience || null,
          availability || null,
          expected_salary_min || null,
          expected_salary_max || null,
          work_authorization || null,
          willing_to_relocate || false,
          preferred_locations || [],
          summary || null,
          additional_notes || null,
          user_id,
        ]
      );
    } else {
      // Create new profile
      result = await db.query(
        `INSERT INTO candidate_profiles (
         user_id, date_of_birth, address, city, state, country, zip_code,
         linkedin_url, portfolio_url, github_url, current_job_title,
         current_company, years_of_experience, availability,
         expected_salary_min, expected_salary_max, work_authorization,
         willing_to_relocate, preferred_locations, summary, additional_notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         RETURNING *`,
        [
          user_id,
          date_of_birth || null,
          address || null,
          city || null,
          state || null,
          country || null,
          zip_code || null,
          linkedin_url || null,
          portfolio_url || null,
          github_url || null,
          current_job_title || null,
          current_company || null,
          years_of_experience || null,
          availability || null,
          expected_salary_min || null,
          expected_salary_max || null,
          work_authorization || null,
          willing_to_relocate || false,
          preferred_locations || [],
          summary || null,
          additional_notes || null,
        ]
      );
    }

    res.status(existing.rows.length > 0 ? 200 : 201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving candidate profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


