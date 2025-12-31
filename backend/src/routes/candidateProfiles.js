/**
 * Candidate Profiles routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import { logActivity, logChanges } from '../utils/activityLog.js';

export async function handleCandidateProfiles(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get candidate profile by user_id or direct ID
  // Supports: /api/candidate-profiles/user/:id or /api/candidate-profiles/:id
  const profileByUserIdMatch = path.match(/^\/api\/candidate-profiles\/user\/(\d+)$/);
  const profileByIdMatch = path.match(/^\/api\/candidate-profiles\/(\d+)$/);
  
  if ((profileByUserIdMatch || profileByIdMatch) && method === 'GET') {
    const userId = profileByUserIdMatch ? profileByUserIdMatch[1] : profileByIdMatch[1];
    
    // Allow users to view their own profile, or consultants/admins to view any profile
    if (user.id !== parseInt(userId) && !['consultant', 'admin'].includes(user.role)) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const profile = await queryOne(
        env,
        `SELECT cp.*, jr.name as job_classification_name 
         FROM candidate_profiles cp
         LEFT JOIN job_roles jr ON cp.job_classification = jr.id
         WHERE cp.user_id = ?`,
        [userId]
      );

      if (!profile) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Profile not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Parse JSON fields
      if (profile.preferred_locations && typeof profile.preferred_locations === 'string') {
        try {
          profile.preferred_locations = JSON.parse(profile.preferred_locations);
        } catch (e) {
          profile.preferred_locations = [];
        }
      }

      // Log view activity
      await logActivity(env, {
        userId: user.id,
        entityType: 'candidate_profile',
        entityId: profile.id,
        action: 'view',
        description: `Viewed candidate profile for user ${userId}`,
        request
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify(profile),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching candidate profile:', error);
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

  // Create or update candidate profile
  if (path === '/api/candidate-profiles' && (method === 'POST' || method === 'PUT')) {
    // Allow candidates to update their own profile, or consultants/admins to update any profile
    try {
      const body = await request.json();
      const { user_id, ...profileData } = body;

      if (!user_id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'user_id is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check permissions
      if (user.id !== parseInt(user_id) && !['consultant', 'admin'].includes(user.role)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check if profile exists
      const existing = await queryOne(
        env,
        'SELECT * FROM candidate_profiles WHERE user_id = ?',
        [user_id]
      );

      let result;
      let oldData = null;

      if (existing) {
        // Update existing profile
        oldData = { ...existing };
        
        // Prepare update data
        const updateFields = [];
        const updateValues = [];
        
        const fields = [
          'date_of_birth', 'address', 'city', 'state', 'country', 'zip_code',
          'linkedin_url', 'portfolio_url', 'github_url', 'job_classification',
          'current_job_title', 'current_company', 'years_of_experience', 'availability',
          'expected_salary_min', 'expected_salary_max', 'work_authorization',
          'willing_to_relocate', 'preferred_locations', 'summary', 'additional_notes'
        ];

        for (const field of fields) {
          if (profileData.hasOwnProperty(field)) {
            updateFields.push(`${field} = ?`);
            let value = profileData[field];
            
            // Handle special cases
            if (field === 'preferred_locations' && Array.isArray(value)) {
              value = JSON.stringify(value);
            } else if (field === 'willing_to_relocate') {
              value = value ? 1 : 0;
            } else if (field === 'job_classification') {
              // Convert to integer or null
              value = value ? parseInt(value) : null;
            } else if (value === '' || value === null || value === undefined) {
              value = null;
            }
            
            updateValues.push(value);
          }
        }

        if (updateFields.length === 0) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'No fields to update' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            request
          );
        }

        updateFields.push('updated_at = datetime("now")');
        updateValues.push(user_id);

        await execute(
          env,
          `UPDATE candidate_profiles SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );

        // Get updated profile
        result = await queryOne(
          env,
          `SELECT cp.*, jr.name as job_classification_name 
           FROM candidate_profiles cp
           LEFT JOIN job_roles jr ON cp.job_classification = jr.id
           WHERE cp.user_id = ?`,
          [user_id]
        );

        // Log changes
        await logChanges(env, {
          userId: user.id,
          entityType: 'candidate_profile',
          entityId: result.id,
          oldData,
          newData: result,
          request
        });

        // Auto-match to jobs if job classification was updated
        const newJobClassification = profileData.job_classification || result.job_classification;
        const oldJobClassification = oldData?.job_classification;
        
        if (newJobClassification && newJobClassification !== oldJobClassification) {
          try {
            const { autoMatchByClassification } = await import('./matches.js');
            // Get all active jobs with matching classification ID
            const jobs = await query(env,
              `SELECT j.id
               FROM jobs j
               WHERE j.status = 'active' AND j.job_classification = ?`,
              [newJobClassification]
            );
            // Match candidate to each job
            for (const job of jobs) {
              await autoMatchByClassification(env, job.id);
            }
          } catch (e) {
            console.error('Error auto-matching after profile update:', e);
            // Don't fail the update if matching fails
          }
        }
      } else {
        // Create new profile
        const insertFields = ['user_id'];
        const insertValues = [user_id];
        const placeholders = ['?'];

        const fields = [
          'date_of_birth', 'address', 'city', 'state', 'country', 'zip_code',
          'linkedin_url', 'portfolio_url', 'github_url', 'job_classification',
          'current_job_title', 'current_company', 'years_of_experience', 'availability',
          'expected_salary_min', 'expected_salary_max', 'work_authorization',
          'willing_to_relocate', 'preferred_locations', 'summary', 'additional_notes'
        ];

        for (const field of fields) {
          insertFields.push(field);
          let value = profileData[field] || null;
          
          if (field === 'preferred_locations' && Array.isArray(value)) {
            value = JSON.stringify(value);
          } else if (field === 'willing_to_relocate') {
            value = value ? 1 : 0;
          } else if (field === 'job_classification') {
            // Convert to integer or null
            value = value ? parseInt(value) : null;
          } else if (value === '' || value === null || value === undefined) {
            value = null;
          }
          
          insertValues.push(value);
          placeholders.push('?');
        }

        const insertResult = await execute(
          env,
          `INSERT INTO candidate_profiles (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
          insertValues
        );

        const profileId = insertResult.meta?.last_row_id || insertResult.lastInsertRowid;
        
        result = await queryOne(
          env,
          `SELECT cp.*, jr.name as job_classification_name 
           FROM candidate_profiles cp
           LEFT JOIN job_roles jr ON cp.job_classification = jr.id
           WHERE cp.id = ?`,
          [profileId]
        );

        // Log creation
        await logActivity(env, {
          userId: user.id,
          entityType: 'candidate_profile',
          entityId: result.id,
          action: 'create',
          description: `Created candidate profile for user ${user_id}`,
          request
        });
      }

      // Parse JSON fields for response
      if (result.preferred_locations && typeof result.preferred_locations === 'string') {
        try {
          result.preferred_locations = JSON.parse(result.preferred_locations);
        } catch (e) {
          result.preferred_locations = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(result),
          { status: existing ? 200 : 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error saving candidate profile:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', message: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Not found
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}
