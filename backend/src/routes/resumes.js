/**
 * Resume routes for Cloudflare Workers with R2 storage
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

/**
 * Upload file to R2
 */
async function uploadToR2(env, file, userId, originalName) {
  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const ext = originalName.split('.').pop();
  const key = `resumes/resume-${userId}-${timestamp}-${randomSuffix}.${ext}`;

  // Upload to R2
  await env.R2_BUCKET.put(key, file, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      originalName,
      userId: userId.toString(),
      uploadedAt: new Date().toISOString(),
    },
  });

  return key;
}

/**
 * Get file from R2
 */
async function getFromR2(env, key) {
  const object = await env.R2_BUCKET.get(key);
  if (!object) {
    return null;
  }
  return object;
}

/**
 * Delete file from R2
 */
async function deleteFromR2(env, key) {
  await env.R2_BUCKET.delete(key);
}

export async function handleResumes(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Upload resume
  if (path === '/api/resumes/upload' && method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('resume');

      if (!file) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'No file uploaded' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(ext)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid file type. Only PDF, DOC, and DOCX are allowed.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'File size exceeds 5MB limit' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const skills = formData.get('skills');
      const experience_years = formData.get('experience_years');
      const education = formData.get('education');
      const summary = formData.get('summary');

      // Upload to R2
      const fileBuffer = await file.arrayBuffer();
      const r2Key = await uploadToR2(env, fileBuffer, user.id, file.name);

      // Store in database
      const result = await execute(
        env,
        `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, skills, experience_years, education, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          r2Key,
          file.name,
          file.size,
          '', // content_text would be extracted from file
          skills ? JSON.stringify(JSON.parse(skills)) : '[]',
          experience_years ? parseInt(experience_years) : null,
          education || '',
          summary || '',
        ]
      );

      const resumeId = result.meta.last_row_id;
      const resume = await queryOne(
        env,
        'SELECT * FROM resumes WHERE id = ?',
        [resumeId]
      );

      // Parse JSON fields
      if (resume.skills) {
        try {
          resume.skills = JSON.parse(resume.skills);
        } catch (e) {
          resume.skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(resume),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error uploading resume:', error);
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

  // Get user's resumes
  if (path === '/api/resumes/my-resumes' && method === 'GET') {
    try {
      const results = await query(
        env,
        'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC',
        [user.id]
      );

      // Parse JSON fields
      const resumes = results.map(resume => {
        if (resume.skills) {
          try {
            resume.skills = JSON.parse(resume.skills);
          } catch (e) {
            resume.skills = [];
          }
        }
        return resume;
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify(resumes),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching resumes:', error);
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

  // Get all resumes (consultant/admin only)
  if (path === '/api/resumes' && method === 'GET') {
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
      const results = await query(
        env,
        `SELECT r.*, u.first_name, u.last_name, u.email 
         FROM resumes r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY r.uploaded_at DESC`
      );

      // Parse JSON fields
      const resumes = results.map(resume => {
        if (resume.skills) {
          try {
            resume.skills = JSON.parse(resume.skills);
          } catch (e) {
            resume.skills = [];
          }
        }
        return resume;
      });

      return addCorsHeaders(
        new Response(
          JSON.stringify(resumes),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching resumes:', error);
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

  // Get single resume
  const singleResumeMatch = path.match(/^\/api\/resumes\/(\d+)$/);
  if (singleResumeMatch && method === 'GET') {
    try {
      const resumeId = singleResumeMatch[1];
      const resume = await queryOne(
        env,
        `SELECT r.*, u.first_name, u.last_name, u.email 
         FROM resumes r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.id = ?`,
        [resumeId]
      );

      if (!resume) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Resume not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check permissions
      if (user.role === 'candidate' && resume.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Parse JSON fields
      if (resume.skills) {
        try {
          resume.skills = JSON.parse(resume.skills);
        } catch (e) {
          resume.skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(resume),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching resume:', error);
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

  // Download resume file
  const downloadMatch = path.match(/^\/api\/resumes\/(\d+)\/download$/);
  if (downloadMatch && method === 'GET') {
    try {
      const resumeId = downloadMatch[1];
      const resume = await queryOne(
        env,
        'SELECT * FROM resumes WHERE id = ?',
        [resumeId]
      );

      if (!resume) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Resume not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check permissions
      if (user.role === 'candidate' && resume.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Get file from R2
      const fileObject = await getFromR2(env, resume.file_path);
      if (!fileObject) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const fileData = await fileObject.arrayBuffer();
      const headers = new Headers();
      headers.set('Content-Type', fileObject.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${resume.file_name}"`);

      return addCorsHeaders(
        new Response(fileData, {
          status: 200,
          headers,
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Error downloading resume:', error);
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

  // Update resume
  if (singleResumeMatch && method === 'PUT') {
    try {
      const resumeId = singleResumeMatch[1];
      const body = await request.json();
      const { skills, experience_years, education, summary } = body;

      // Check ownership
      const resumeCheck = await queryOne(
        env,
        'SELECT user_id FROM resumes WHERE id = ?',
        [resumeId]
      );

      if (!resumeCheck) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Resume not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (resumeCheck.user_id !== user.id && user.role !== 'admin') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      await execute(
        env,
        `UPDATE resumes SET skills = ?, experience_years = ?, education = ?, summary = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          skills ? JSON.stringify(skills) : '[]',
          experience_years,
          education,
          summary,
          resumeId,
        ]
      );

      const updatedResume = await queryOne(
        env,
        'SELECT * FROM resumes WHERE id = ?',
        [resumeId]
      );

      // Parse JSON fields
      if (updatedResume.skills) {
        try {
          updatedResume.skills = JSON.parse(updatedResume.skills);
        } catch (e) {
          updatedResume.skills = [];
        }
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(updatedResume),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating resume:', error);
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

  // Delete resume
  if (singleResumeMatch && method === 'DELETE') {
    try {
      const resumeId = singleResumeMatch[1];
      const resumeCheck = await queryOne(
        env,
        'SELECT user_id, file_path FROM resumes WHERE id = ?',
        [resumeId]
      );

      if (!resumeCheck) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Resume not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (resumeCheck.user_id !== user.id && user.role !== 'admin') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Delete from R2
      if (resumeCheck.file_path) {
        await deleteFromR2(env, resumeCheck.file_path);
      }

      // Delete from database
      await execute(env, 'DELETE FROM resumes WHERE id = ?', [resumeId]);

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Resume deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting resume:', error);
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

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

