/**
 * Matches routes for Cloudflare Workers
 * Handles job matching based on job classification and AI scoring
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import { getAiMatchingConfig } from '../utils/appSettingsDb.js';
import { scoreMatchWithAi, buildJobText, buildCandidateText } from '../utils/aiMatchClient.js';
import { calculateMatchScore, countSkillsMatch } from '../utils/matchScore.js';
import { queueTransactionalEmail } from '../utils/emailService.js';

function parseJobSkillsField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/**
 * Run AI scoring for one job against all active candidates; upsert job_matches when score >= min.
 */
export async function runAiMatchForJob(env, jobId, ctx = null) {
  const config = await getAiMatchingConfig(env);
  const provider = config.provider;
  if (provider === 'openai' && !config.openai_api_key) {
    throw new Error('OpenAI API key not configured');
  }
  if (provider === 'anthropic' && !config.anthropic_api_key) {
    throw new Error('Anthropic API key not configured');
  }
  if (provider === 'gemini' && !config.gemini_api_key) {
    throw new Error('Gemini API key not configured');
  }

  const job = await queryOne(
    env,
    `SELECT j.*, jr.name as job_classification_name
     FROM jobs j
     LEFT JOIN job_roles jr ON j.job_classification = jr.id
     WHERE j.id = ?`,
    [jobId]
  );
  if (!job) {
    return { error: 'Job not found' };
  }
  job.required_skills = parseJobSkillsField(job.required_skills);
  job.preferred_skills = parseJobSkillsField(job.preferred_skills);

  const candidates = await query(
    env,
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
            cp.current_job_title, cp.current_company, cp.years_of_experience, cp.summary, cp.additional_notes
     FROM users u
     INNER JOIN candidate_profiles cp ON u.id = cp.user_id
     WHERE u.role = 'candidate' AND u.is_active = 1`
  );

  const minScore = config.min_match_score ?? 35;
  let matched = 0;
  let cleared = 0;
  const failures = [];

  for (const row of candidates) {
    const profile = {
      current_job_title: row.current_job_title,
      current_company: row.current_company,
      years_of_experience: row.years_of_experience,
      summary: row.summary,
      additional_notes: row.additional_notes,
    };
    const userRow = {
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
    };
    const resume = await queryOne(
      env,
      'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1',
      [row.id]
    );

    try {
      const jobText = buildJobText(job);
      const candText = buildCandidateText(userRow, profile, resume);
      const { score, summary } = await scoreMatchWithAi({ provider, config }, jobText, candText);

      if (score < minScore) {
        await execute(env, 'DELETE FROM job_matches WHERE job_id = ? AND candidate_id = ?', [jobId, row.id]);
        cleared++;
        continue;
      }

      const existing = await queryOne(
        env,
        'SELECT id, resume_id FROM job_matches WHERE job_id = ? AND candidate_id = ? ORDER BY id LIMIT 1',
        [jobId, row.id]
      );
      const resumeId = resume?.id ?? null;
      const notes = summary ? `[AI] ${summary}`.slice(0, 2000) : '[AI]';

      if (existing) {
        await execute(
          env,
          `UPDATE job_matches SET match_score = ?, matched_at = datetime('now'), notes = ?,
           resume_id = COALESCE(?, resume_id) WHERE id = ?`,
          [score, notes, resumeId, existing.id]
        );
      } else {
        await execute(
          env,
          `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match, notes)
           VALUES (?, ?, ?, ?, 0, 0, 0, ?)`,
          [jobId, resumeId, row.id, score, notes]
        );
        queueTransactionalEmail(ctx, env, 'job_match_found', row.email, {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          job_title: job.title || '',
          job_company: job.company || '',
          match_score: String(score),
        });
      }
      matched++;
    } catch (e) {
      console.error('AI match error candidate', row.id, e);
      failures.push({ candidate_id: row.id, error: e.message });
    }
  }

  return {
    job_id: Number(jobId),
    upserted: matched,
    below_threshold_removed: cleared,
    failures,
    total_candidates: candidates.length,
  };
}

/**
 * Run AI scoring for one candidate against all active jobs; upsert job_matches when score >= min.
 */
export async function runAiMatchForCandidate(env, candidateId, ctx = null) {
  const config = await getAiMatchingConfig(env);
  const provider = config.provider;
  if (provider === 'openai' && !config.openai_api_key) {
    throw new Error('OpenAI API key not configured');
  }
  if (provider === 'anthropic' && !config.anthropic_api_key) {
    throw new Error('Anthropic API key not configured');
  }
  if (provider === 'gemini' && !config.gemini_api_key) {
    throw new Error('Gemini API key not configured');
  }

  const row = await queryOne(
    env,
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
            cp.current_job_title, cp.current_company, cp.years_of_experience, cp.summary, cp.additional_notes
     FROM users u
     INNER JOIN candidate_profiles cp ON u.id = cp.user_id
     WHERE u.id = ? AND u.role = 'candidate' AND u.is_active = 1`,
    [candidateId]
  );
  if (!row) {
    return { error: 'Candidate not found or inactive' };
  }

  const profile = {
    current_job_title: row.current_job_title,
    current_company: row.current_company,
    years_of_experience: row.years_of_experience,
    summary: row.summary,
    additional_notes: row.additional_notes,
  };
  const userRow = {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
  };
  const resume = await queryOne(
    env,
    'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1',
    [candidateId]
  );

  const jobs = await query(
    env,
    `SELECT j.*, jr.name as job_classification_name
     FROM jobs j
     LEFT JOIN job_roles jr ON j.job_classification = jr.id
     WHERE j.status = 'active'`
  );

  const minScore = config.min_match_score ?? 35;
  let matched = 0;
  let cleared = 0;
  const failures = [];

  for (const job of jobs) {
    job.required_skills = parseJobSkillsField(job.required_skills);
    job.preferred_skills = parseJobSkillsField(job.preferred_skills);

    try {
      const jobText = buildJobText(job);
      const candText = buildCandidateText(userRow, profile, resume);
      const { score, summary } = await scoreMatchWithAi({ provider, config }, jobText, candText);

      if (score < minScore) {
        await execute(env, 'DELETE FROM job_matches WHERE job_id = ? AND candidate_id = ?', [job.id, candidateId]);
        cleared++;
        continue;
      }

      const existing = await queryOne(
        env,
        'SELECT id, resume_id FROM job_matches WHERE job_id = ? AND candidate_id = ? ORDER BY id LIMIT 1',
        [job.id, candidateId]
      );
      const resumeId = resume?.id ?? null;
      const notes = summary ? `[AI] ${summary}`.slice(0, 2000) : '[AI]';

      if (existing) {
        await execute(
          env,
          `UPDATE job_matches SET match_score = ?, matched_at = datetime('now'), notes = ?,
           resume_id = COALESCE(?, resume_id) WHERE id = ?`,
          [score, notes, resumeId, existing.id]
        );
      } else {
        await execute(
          env,
          `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match, notes)
           VALUES (?, ?, ?, ?, 0, 0, 0, ?)`,
          [job.id, resumeId, candidateId, score, notes]
        );
        if (userRow?.email) {
          queueTransactionalEmail(ctx, env, 'job_match_found', userRow.email, {
            first_name: userRow.first_name,
            last_name: userRow.last_name,
            email: userRow.email,
            job_title: job.title || '',
            job_company: job.company || '',
            match_score: String(score),
          });
        }
      }
      matched++;
    } catch (e) {
      console.error('AI match error job', job.id, e);
      failures.push({ job_id: job.id, error: e.message });
    }
  }

  return {
    candidate_id: Number(candidateId),
    upserted: matched,
    below_threshold_removed: cleared,
    failures,
    total_jobs: jobs.length,
  };
}

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

export async function handleMatches(request, env, user, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // AI recompute matches for one job (admin/consultant)
  const aiRecomputeJobMatch = path.match(/^\/api\/matches\/ai-recompute-job\/(\d+)$/);
  if (aiRecomputeJobMatch && method === 'POST') {
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
      const jobId = aiRecomputeJobMatch[1];
      const result = await runAiMatchForJob(env, jobId, ctx);
      if (result.error) {
        return addCorsHeaders(
          new Response(JSON.stringify(result), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      return addCorsHeaders(
        new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('AI recompute job:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: error.message || 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // AI recompute matches for one candidate (admin/consultant)
  const aiRecomputeCandidateMatch = path.match(/^\/api\/matches\/ai-recompute-candidate\/(\d+)$/);
  if (aiRecomputeCandidateMatch && method === 'POST') {
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
      const candidateId = aiRecomputeCandidateMatch[1];
      const result = await runAiMatchForCandidate(env, candidateId, ctx);
      if (result.error) {
        return addCorsHeaders(
          new Response(JSON.stringify(result), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      return addCorsHeaders(
        new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('AI recompute candidate:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: error.message || 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

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
         WHERE jm.candidate_id = ? AND j.status = 'active'
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
        `SELECT jm.*, u.first_name, u.last_name, u.email, cp.current_job_title, cp.job_classification,
                jr.name as job_classification_name
         FROM job_matches jm
         INNER JOIN users u ON jm.candidate_id = u.id
         LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
         LEFT JOIN job_roles jr ON cp.job_classification = jr.id
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

  // Match resume to job (rule-based scoring)
  if (path === '/api/matches/match' && method === 'POST') {
    try {
      const body = await request.json();
      const { resume_id, job_id } = body;

      if (!resume_id || !job_id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'resume_id and job_id are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const resume = await queryOne(env, 'SELECT * FROM resumes WHERE id = ?', [resume_id]);
      const job = await queryOne(env, 'SELECT * FROM jobs WHERE id = ?', [job_id]);

      if (!resume || !job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Resume or job not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (
        resume.user_id !== user.id &&
        user.role !== 'admin' &&
        user.role !== 'consultant'
      ) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }

      const matchScore = calculateMatchScore(resume, job);
      const skillsMatch = countSkillsMatch(resume, job);

      const existingMatch = await queryOne(
        env,
        'SELECT * FROM job_matches WHERE job_id = ? AND resume_id = ?',
        [job_id, resume_id]
      );

      if (existingMatch) {
        await execute(
          env,
          `UPDATE job_matches SET match_score = ?, skills_match = ?, matched_at = datetime('now')
           WHERE id = ?`,
          [matchScore, skillsMatch, existingMatch.id]
        );
        const updated = await queryOne(env, 'SELECT * FROM job_matches WHERE id = ?', [existingMatch.id]);
        return addCorsHeaders(
          new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }

      const insertResult = await execute(
        env,
        `INSERT INTO job_matches (job_id, resume_id, candidate_id, match_score, skills_match, experience_match, education_match)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          job_id,
          resume_id,
          resume.user_id,
          matchScore,
          skillsMatch,
          resume.experience_years || 0,
          1,
        ]
      );

      const matchId = insertResult.meta?.last_row_id || insertResult.lastInsertRowid;
      const created = await queryOne(env, 'SELECT * FROM job_matches WHERE id = ?', [matchId]);

      return addCorsHeaders(
        new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Error matching resume:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
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
