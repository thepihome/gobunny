/**
 * Resume routes for Cloudflare Workers — D1-first content, optional R2 file backup.
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import {
  buildResumePlainText,
  metadataFromStructured,
  parseStructuredContent,
  sanitizeResumeForClient,
  emptyStructuredContent,
  resolveDraftResume,
} from '../utils/resumeContent.js';
import {
  analyzeResumeWithAi,
  scoreResumeAgainstJd,
  getResumeEditorSuggestions,
  parseResumeTextWithAi,
  buildJdTextFromJob,
} from '../utils/resumeAiClient.js';

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
  if (key) await env.R2_BUCKET.delete(key);
}

function canAccessResume(user, resume) {
  if (!resume) return false;
  if (user.role === 'admin' || user.role === 'consultant') return true;
  return user.role === 'candidate' && resume.user_id === user.id;
}

function parseJsonFormField(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

async function fetchResumeById(env, resumeId) {
  return queryOne(env, 'SELECT * FROM resumes WHERE id = ?', [resumeId]);
}

async function insertResumeRow(env, row) {
  const result = await execute(
    env,
    `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, structured_content,
     ai_insights, source_type, skills, experience_years, education, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row
  );
  const resumeId = result.meta?.last_row_id || result.lastInsertRowid;
  return fetchResumeById(env, resumeId);
}

async function maybeAutoParse(env, resume) {
  const text = (resume.content_text || '').trim();
  if (!text || resume.structured_content) return resume;
  try {
    const structured = await parseResumeTextWithAi(env, text);
    const meta = metadataFromStructured(structured);
    await execute(
      env,
      `UPDATE resumes SET structured_content = ?, skills = ?, experience_years = COALESCE(?, experience_years),
       education = COALESCE(?, education), summary = COALESCE(?, summary), updated_at = datetime('now')
       WHERE id = ?`,
      [
        JSON.stringify(structured),
        JSON.stringify(meta.skills),
        meta.experience_years,
        meta.education || null,
        meta.summary || null,
        resume.id,
      ]
    );
    return fetchResumeById(env, resume.id);
  } catch (e) {
    console.error('Auto-parse resume failed:', e.message);
    return resume;
  }
}

export async function handleResumes(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Create resume from editor / pasted text (no R2)
  if (path === '/api/resumes/create-text' && method === 'POST') {
    try {
      const body = await request.json();
      const contentText = (body.content_text || '').trim();
      const structured = parseStructuredContent(body.structured_content || emptyStructuredContent());
      if (!contentText && !structured.summary && !(structured.experience?.length)) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Resume content is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      const countRow = await queryOne(
        env,
        'SELECT COUNT(*) as count FROM resumes WHERE user_id = ?',
        [user.id]
      );
      if ((countRow?.count || 0) >= 5) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Maximum of 5 resumes allowed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      const meta = metadataFromStructured(structured);
      const resume = await insertResumeRow(env, [
        user.id,
        null,
        body.file_name || 'My Resume',
        null,
        contentText || buildResumePlainText({ structured_content: structured }),
        JSON.stringify(structured),
        null,
        'editor',
        JSON.stringify(body.skills?.length ? body.skills : meta.skills),
        body.experience_years ?? meta.experience_years,
        body.education || meta.education,
        body.summary || structured.summary || meta.summary,
      ]);
      return addCorsHeaders(
        new Response(JSON.stringify(sanitizeResumeForClient(resume)), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating text resume:', error);
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
      const contentText = (formData.get('content_text') || '').trim();
      const structuredRaw = formData.get('structured_content');
      const storeFile = formData.get('store_file') !== 'false';

      const countRow = await queryOne(
        env,
        'SELECT COUNT(*) as count FROM resumes WHERE user_id = ?',
        [user.id]
      );
      if ((countRow?.count || 0) >= 5) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Maximum of 5 resumes allowed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }

      let r2Key = null;
      if (storeFile) {
        const fileBuffer = await file.arrayBuffer();
        r2Key = await uploadToR2(env, fileBuffer, user.id, file.name);
      }

      const structured = structuredRaw
        ? parseJsonFormField(structuredRaw, emptyStructuredContent())
        : emptyStructuredContent();
      const meta = metadataFromStructured(structured);

      let skillsArr = [];
      if (skills) {
        try {
          skillsArr = parseJsonFormField(skills, []);
        } catch {
          skillsArr = [];
        }
      }
      if (!skillsArr.length && meta.skills.length) skillsArr = meta.skills;

      const result = await execute(
        env,
        `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, structured_content,
         source_type, skills, experience_years, education, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          r2Key,
          file.name,
          file.size,
          contentText,
          structuredRaw ? JSON.stringify(structured) : null,
          contentText && !storeFile ? 'import' : 'file',
          JSON.stringify(skillsArr),
          experience_years ? parseInt(experience_years, 10) : meta.experience_years,
          education || meta.education || '',
          summary || structured.summary || meta.summary || '',
        ]
      );

      const resumeId = result.meta.last_row_id;
      let resume = await queryOne(env, 'SELECT * FROM resumes WHERE id = ?', [resumeId]);
      if (contentText && !structuredRaw) {
        resume = await maybeAutoParse(env, resume);
      }

      return addCorsHeaders(
        new Response(JSON.stringify(sanitizeResumeForClient(resume)), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
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

      const resumes = results.map((resume) => sanitizeResumeForClient(resume));

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

      const resumes = results.map((resume) => sanitizeResumeForClient(resume));

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

  // AI: analyze resume quality & ATS readiness
  const analyzeMatch = path.match(/^\/api\/resumes\/(\d+)\/analyze$/);
  if (analyzeMatch && method === 'POST') {
    try {
      const resumeId = analyzeMatch[1];
      const resume = await fetchResumeById(env, resumeId);
      if (!resume) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      const body = await request.json().catch(() => ({}));
      const draft = resolveDraftResume(resume, body);
      const text = buildResumePlainText(draft);
      if (!text.trim()) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'No resume content to analyze. Add text in the editor first.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      const analysis = await analyzeResumeWithAi(env, text);
      const suggestionsResult = await getResumeEditorSuggestions(
        env,
        text,
        draft.structured_content,
        'all',
        ''
      );
      const insights = {
        last_analysis: analysis,
        last_suggestions: suggestionsResult.suggestions,
      };
      if (!body.draft_only) {
        await execute(
          env,
          `UPDATE resumes SET ai_insights = ?, updated_at = datetime('now') WHERE id = ?`,
          [JSON.stringify(insights), resumeId]
        );
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify({ analysis, suggestions: suggestionsResult.suggestions }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Analyze resume error:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: error.message || 'Analysis failed' }), {
          status: error.message?.includes('not configured') ? 503 : 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
  }

  // AI: score resume against JD or job from list
  const scoreMatch = path.match(/^\/api\/resumes\/(\d+)\/score$/);
  if (scoreMatch && method === 'POST') {
    try {
      const resumeId = scoreMatch[1];
      const resume = await fetchResumeById(env, resumeId);
      if (!resume) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      const body = await request.json();
      let jdText = (body.job_description || '').trim();
      if (body.job_id) {
        const jobText = await buildJdTextFromJob(env, body.job_id);
        if (!jobText) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
            env,
            request
          );
        }
        jdText = jobText;
      }
      if (!jdText) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Provide job_id or job_description' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      const draft = resolveDraftResume(resume, body);
      const text = buildResumePlainText(draft);
      const result = await scoreResumeAgainstJd(env, text, jdText);
      let suggestions = [];
      try {
        const sug = await getResumeEditorSuggestions(
          env,
          text,
          draft.structured_content,
          'all',
          jdText
        );
        suggestions = sug.suggestions;
      } catch (e) {
        console.error('Score follow-up suggestions failed:', e.message);
      }
      return addCorsHeaders(
        new Response(JSON.stringify({ ...result, job_id: body.job_id || null, suggestions }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Score resume error:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: error.message || 'Scoring failed' }), {
          status: error.message?.includes('not configured') ? 503 : 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
  }

  // AI: editor fix suggestions
  const suggestionsMatch = path.match(/^\/api\/resumes\/(\d+)\/suggestions$/);
  if (suggestionsMatch && method === 'POST') {
    try {
      const resumeId = suggestionsMatch[1];
      const resume = await fetchResumeById(env, resumeId);
      if (!resume) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      const body = await request.json().catch(() => ({}));
      const draft = resolveDraftResume(resume, body);
      const text = buildResumePlainText(draft);
      let jobContext = body.job_description || '';
      if (body.job_id) {
        jobContext = (await buildJdTextFromJob(env, body.job_id)) || jobContext;
      }
      const result = await getResumeEditorSuggestions(
        env,
        text,
        draft.structured_content,
        body.section || 'all',
        jobContext
      );
      return addCorsHeaders(
        new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('Suggestions error:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: error.message || 'Suggestions failed' }), {
          status: error.message?.includes('not configured') ? 503 : 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
  }

  // AI: parse plain text into structured sections
  const parseMatch = path.match(/^\/api\/resumes\/(\d+)\/parse$/);
  if (parseMatch && method === 'POST') {
    try {
      const resumeId = parseMatch[1];
      const resume = await fetchResumeById(env, resumeId);
      if (!resume) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      const body = await request.json().catch(() => ({}));
      const text = (body.content_text || resume.content_text || buildResumePlainText(resume)).trim();
      if (!text) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'No text to parse' }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
          env,
          request
        );
      }
      const structured = await parseResumeTextWithAi(env, text);
      const meta = metadataFromStructured(structured);
      await execute(
        env,
        `UPDATE resumes SET content_text = ?, structured_content = ?, skills = ?, experience_years = COALESCE(?, experience_years),
         education = COALESCE(?, education), summary = COALESCE(?, summary), updated_at = datetime('now') WHERE id = ?`,
        [
          text,
          JSON.stringify(structured),
          JSON.stringify(meta.skills),
          meta.experience_years,
          meta.education || null,
          meta.summary || null,
          resumeId,
        ]
      );
      const updated = await fetchResumeById(env, resumeId);
      return addCorsHeaders(
        new Response(JSON.stringify(sanitizeResumeForClient(updated)), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        env,
        request
      );
    } catch (error) {
      console.error('Parse resume error:', error);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: error.message || 'Parse failed' }), {
          status: error.message?.includes('not configured') ? 503 : 500,
          headers: { 'Content-Type': 'application/json' },
        }),
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

      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      return addCorsHeaders(
        new Response(
          JSON.stringify(sanitizeResumeForClient(resume)),
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

      if (!canAccessResume(user, resume)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (!resume.file_path) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({
              error: 'No file stored for this resume. Content is saved in the editor — use Resume Studio to view or export.',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
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
      const {
        skills,
        experience_years,
        education,
        summary,
        content_text,
        structured_content,
        file_name,
      } = body;

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

      const structured = structured_content != null ? parseStructuredContent(structured_content) : null;
      const meta = structured ? metadataFromStructured(structured) : null;
      const plainText =
        content_text != null
          ? content_text
          : structured
            ? buildResumePlainText({ structured_content: structured, summary, skills, education })
            : null;

      await execute(
        env,
        `UPDATE resumes SET
         skills = COALESCE(?, skills),
         experience_years = COALESCE(?, experience_years),
         education = COALESCE(?, education),
         summary = COALESCE(?, summary),
         content_text = COALESCE(?, content_text),
         structured_content = COALESCE(?, structured_content),
         file_name = COALESCE(?, file_name),
         source_type = CASE WHEN ? IS NOT NULL THEN 'editor' ELSE source_type END,
         updated_at = datetime('now')
         WHERE id = ?`,
        [
          skills != null ? JSON.stringify(skills) : meta ? JSON.stringify(meta.skills) : null,
          experience_years ?? meta?.experience_years ?? null,
          education ?? meta?.education ?? null,
          summary ?? structured?.summary ?? meta?.summary ?? null,
          plainText,
          structured ? JSON.stringify(structured) : null,
          file_name || null,
          structured ? JSON.stringify(structured) : null,
          resumeId,
        ]
      );

      const updatedResume = await queryOne(
        env,
        'SELECT * FROM resumes WHERE id = ?',
        [resumeId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(sanitizeResumeForClient(updatedResume)),
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

  // Upload resume for a candidate (admin only)
  const uploadForCandidateMatch = path.match(/^\/api\/resumes\/upload-for-candidate\/(\d+)$/);
  if (uploadForCandidateMatch && method === 'POST') {
    const authError = authorize('admin')(user);
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
      const candidateId = parseInt(uploadForCandidateMatch[1], 10);
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

      const candidate = await queryOne(
        env,
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [candidateId, 'candidate']
      );
      if (!candidate) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Candidate not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const countRow = await queryOne(
        env,
        'SELECT COUNT(*) as count FROM resumes WHERE user_id = ?',
        [candidateId]
      );
      if ((countRow?.count || 0) >= 3) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Maximum of 3 resumes allowed per candidate' }),
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

      const fileBuffer = await file.arrayBuffer();
      const r2Key = await uploadToR2(env, fileBuffer, candidateId, file.name);

      let skillsJson = '[]';
      if (skills) {
        try {
          skillsJson = JSON.stringify(typeof skills === 'string' ? JSON.parse(skills) : skills);
        } catch {
          skillsJson = '[]';
        }
      }

      const result = await execute(
        env,
        `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, skills, experience_years, education, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidateId,
          r2Key,
          file.name,
          file.size,
          '',
          skillsJson,
          experience_years ? parseInt(experience_years, 10) : null,
          education || '',
          summary || '',
        ]
      );

      const resumeId = result.meta?.last_row_id || result.lastInsertRowid;
      const resume = await queryOne(env, 'SELECT * FROM resumes WHERE id = ?', [resumeId]);
      if (resume?.skills) {
        try {
          resume.skills = JSON.parse(resume.skills);
        } catch {
          resume.skills = [];
        }
      }

      return addCorsHeaders(
        new Response(JSON.stringify(resume), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (error) {
      console.error('Error uploading resume for candidate:', error);
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

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

