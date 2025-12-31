/**
 * Matches routes for Cloudflare Workers
 * Handles job matching based on job classification
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

// Auto-match candidates to jobs based on job classification
export async function autoMatchByClassification(env, jobId) {
  try {
    // Get job with classification - join with job_roles to get the name
    const job = await queryOne(env,
      `SELECT j.*, jr.name as job_classification_name, jr.id as job_classification_id
       FROM jobs j 
       LEFT JOIN job_roles jr ON j.job_classification = jr.id 
       WHERE j.id = ?`,
      [jobId]
    );

    if (!job) {
      return { matched: 0, message: 'Job not found' };
    }

    if (!job.job_classification || !job.job_classification_name) {
      return { matched: 0, message: 'Job has no classification' };
    }

    // Get job role name (this is what candidates store in current_job_title)
    const jobRoleName = job.job_classification_name ? job.job_classification_name.trim() : null;

    if (!jobRoleName) {
      return { matched: 0, message: 'Job has no classification name' };
    }

    console.log(`Auto-matching: Job ID ${jobId}, Classification ID: ${job.job_classification}, Name: "${jobRoleName}"`);

    // Find candidates with matching job classification
    // Now using job_classification ID (same as jobs table) for direct ID comparison
    let candidates = await query(env,
      `SELECT DISTINCT u.id as candidate_id, cp.job_classification, cp.years_of_experience, jr.name as job_classification_name
       FROM users u
       INNER JOIN candidate_profiles cp ON u.id = cp.user_id
       LEFT JOIN job_roles jr ON cp.job_classification = jr.id
       WHERE u.role = 'candidate' 
       AND u.is_active = 1
       AND cp.job_classification = ?`,
      [job.job_classification]
    );

    // Fallback: If no matches with ID, try old method using current_job_title (for backward compatibility)
    if (candidates.length === 0) {
      console.log('Trying fallback method: using current_job_title (legacy)');
      candidates = await query(env,
        `SELECT DISTINCT u.id as candidate_id, cp.current_job_title, cp.years_of_experience, cp.current_job_title as job_classification_name
         FROM users u
         INNER JOIN candidate_profiles cp ON u.id = cp.user_id
         WHERE u.role = 'candidate' 
         AND u.is_active = 1
         AND cp.current_job_title IS NOT NULL
         AND cp.current_job_title != ''
         AND TRIM(LOWER(cp.current_job_title)) = TRIM(LOWER(?))`,
        [jobRoleName]
      );
    }

    console.log(`Found ${candidates.length} candidates with matching classification "${jobRoleName}"`);
    
    // Debug: Log what candidates have for troubleshooting
    if (candidates.length === 0) {
      const allCandidates = await query(env,
        `SELECT DISTINCT cp.current_job_title, COUNT(*) as count
         FROM candidate_profiles cp
         INNER JOIN users u ON cp.user_id = u.id
         WHERE u.role = 'candidate' AND u.is_active = 1 AND cp.current_job_title IS NOT NULL AND cp.current_job_title != ''
         GROUP BY cp.current_job_title`
      );
      console.log(`Job classification looking for: "${jobRoleName}" (ID: ${job.job_classification})`);
      console.log('Available candidate classifications:', allCandidates.map(c => `"${c.current_job_title}" (${c.count})`).join(', '));
    }

    let matched = 0;
    const matches = [];

    for (const candidate of candidates) {
      // Get candidate's primary resume (optional - not required for matching)
      const resume = await queryOne(env,
        'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1',
        [candidate.candidate_id]
      );

      // Calculate basic match score (classification match = 50 points base)
      let matchScore = 50;

      // Add points for skills match if available (from resume or profile)
      let resumeSkills = [];
      if (resume && resume.skills) {
        try {
          resumeSkills = typeof resume.skills === 'string' 
            ? JSON.parse(resume.skills) 
            : resume.skills;
        } catch (e) {
          console.error('Error parsing resume skills:', e);
        }
      }

      if (job.required_skills) {
        try {
          const jobSkills = typeof job.required_skills === 'string'
            ? JSON.parse(job.required_skills)
            : job.required_skills;

          if (Array.isArray(resumeSkills) && Array.isArray(jobSkills) && jobSkills.length > 0) {
            const matchingSkills = resumeSkills.filter(skill =>
              jobSkills.some(js => js.toLowerCase() === skill.toLowerCase())
            );
            matchScore += Math.min(30, (matchingSkills.length / Math.max(jobSkills.length, 1)) * 30);
          }
        } catch (e) {
          console.error('Error parsing job skills:', e);
        }
      }

      // Add points for experience match (from resume or profile)
      let experienceYears = null;
      if (resume && resume.experience_years) {
        experienceYears = resume.experience_years;
      } else if (candidate.years_of_experience) {
        experienceYears = candidate.years_of_experience;
      }

      if (experienceYears !== null && job.experience_level) {
        const expMap = { 'entry': 0, 'junior': 1, 'mid': 3, 'senior': 5, 'executive': 10 };
        const requiredExp = expMap[job.experience_level.toLowerCase()] || 0;
        if (experienceYears >= requiredExp) {
          matchScore += 20;
        } else if (requiredExp > 0) {
          matchScore += Math.min(20, (experienceYears / requiredExp) * 20);
        }
      }

      matchScore = Math.min(100, Math.round(matchScore));

      // Check if match already exists
      const existingMatch = await queryOne(env,
        'SELECT id FROM job_matches WHERE job_id = ? AND candidate_id = ?',
        [jobId, candidate.candidate_id]
      );

      if (existingMatch) {
        // Update existing match
        await execute(env,
          `UPDATE job_matches 
           SET match_score = ?, matched_at = datetime('now')
           WHERE id = ?`,
          [matchScore, existingMatch.id]
        );
        console.log(`Updated match for candidate ${candidate.candidate_id} to job ${jobId} with score ${matchScore}`);
      } else {
        // Create new match (resume_id is optional)
        await execute(env,
          `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            jobId,
            resume ? resume.id : null,
            candidate.candidate_id,
            matchScore,
            0, // skills_match - calculated separately if needed
            experienceYears || 0,
            1  // education_match placeholder
          ]
        );
        console.log(`Created match for candidate ${candidate.candidate_id} to job ${jobId} with score ${matchScore}`);
      }

      matched++;
      matches.push({ candidate_id: candidate.candidate_id, match_score: matchScore });
    }

    return { matched, matches, message: `Matched ${matched} candidates` };
  } catch (error) {
    console.error('Error in auto-match:', error);
    throw error;
  }
}

export async function handleMatches(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auto-match candidates to a job based on classification
  const autoMatchMatch = path.match(/^\/api\/matches\/auto-match\/(\d+)$/);
  if (autoMatchMatch && method === 'POST') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const jobId = autoMatchMatch[1];
      const result = await autoMatchByClassification(env, jobId);

      return addCorsHeaders(
        new Response(
          JSON.stringify(result),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error auto-matching:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Get matches for a candidate
  const candidateMatchesMatch = path.match(/^\/api\/matches\/candidate\/(\d+)$/);
  if (candidateMatchesMatch && method === 'GET') {
    try {
      const candidateId = candidateMatchesMatch[1];

      // Verify access
      if (user.role !== 'admin' && user.role !== 'consultant' && user.id !== parseInt(candidateId)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const matches = await query(env,
        `SELECT jm.*, j.title, j.company, j.location, j.employment_type, j.status as job_status,
                j.title as job_title
         FROM job_matches jm
         INNER JOIN jobs j ON jm.job_id = j.id
         WHERE jm.candidate_id = ?
         ORDER BY jm.match_score DESC, jm.matched_at DESC`,
        [candidateId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(matches),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching matches:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Get matches for a job
  const jobMatchesMatch = path.match(/^\/api\/matches\/job\/(\d+)$/);
  if (jobMatchesMatch && method === 'GET') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const jobId = jobMatchesMatch[1];

      const matches = await query(env,
        `SELECT jm.*, u.first_name, u.last_name, u.email, cp.current_job_title
         FROM job_matches jm
         INNER JOIN users u ON jm.candidate_id = u.id
         LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
         WHERE jm.job_id = ?
         ORDER BY jm.match_score DESC, jm.matched_at DESC`,
        [jobId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(matches),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching job matches:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Return not implemented for other endpoints
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Endpoint not implemented' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}
