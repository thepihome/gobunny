/**
 * Call OpenAI / Anthropic / Gemini to score job–candidate fit (0–100).
 */

function buildPrompt(jobBlock, candidateBlock) {
  return `You are an expert technical recruiter. Score how well the candidate fits the job on a scale of 0 to 100 (integer only).

Respond with a single JSON object and no other text, in this exact shape:
{"score": <number 0-100>, "summary": "<one short sentence>"}

JOB:
${jobBlock}

CANDIDATE:
${candidateBlock}`;
}

function clampScore(n) {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function parseJsonFromText(text) {
  if (!text) return { score: 0, summary: '' };
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) return { score: 0, summary: '' };
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1));
    return { score: clampScore(obj.score), summary: String(obj.summary || '').slice(0, 500) };
  } catch {
    return { score: 0, summary: '' };
  }
}

export async function scoreMatchWithAi({ provider, config }, jobText, candidateText) {
  const prompt = buildPrompt(jobText, candidateText);

  if (provider === 'openai') {
    const key = config.openai_api_key;
    const model = config.openai_model || 'gpt-4o-mini';
    if (!key) throw new Error('OpenAI API key not configured');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return parseJsonFromText(content);
  }

  if (provider === 'anthropic') {
    const key = config.anthropic_api_key;
    const model = config.anthropic_model || 'claude-3-5-sonnet-20241022';
    if (!key) throw new Error('Anthropic API key not configured');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.content?.[0]?.text || '';
    return parseJsonFromText(content);
  }

  if (provider === 'gemini') {
    const key = config.gemini_api_key;
    const model = config.gemini_model || 'gemini-1.5-flash';
    if (!key) throw new Error('Gemini API key not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseJsonFromText(content);
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

export function buildJobText(job) {
  const skills = Array.isArray(job.required_skills)
    ? job.required_skills.join(', ')
    : job.required_skills || '';
  const pref = Array.isArray(job.preferred_skills)
    ? job.preferred_skills.join(', ')
    : job.preferred_skills || '';
  return [
    `Title: ${job.title || ''}`,
    `Company: ${job.company || ''}`,
    `Location: ${job.location || ''}`,
    `Type: ${job.employment_type || ''}`,
    `Experience level: ${job.experience_level || ''}`,
    `Description: ${(job.description || '').slice(0, 8000)}`,
    `Required skills: ${skills}`,
    `Preferred skills: ${pref}`,
  ].join('\n');
}

export function buildCandidateText(userRow, profile, resume) {
  let skills = '';
  if (resume?.skills) {
    try {
      const s = typeof resume.skills === 'string' ? JSON.parse(resume.skills) : resume.skills;
      skills = Array.isArray(s) ? s.join(', ') : String(s);
    } catch {
      skills = String(resume.skills);
    }
  }
  const contentText = (resume?.content_text || '').trim();
  const resumeBody = contentText
    ? `Full resume text:\n${contentText.slice(0, 8000)}`
    : [
        `Summary: ${(profile?.summary || resume?.summary || '').slice(0, 4000)}`,
        `Skills: ${skills}`,
        `Education: ${resume?.education || profile?.additional_notes || ''}`.slice(0, 2000),
      ].join('\n');
  return [
    `Name: ${userRow.first_name || ''} ${userRow.last_name || ''}`,
    `Email: ${userRow.email || ''}`,
    `Phone: ${userRow.phone || ''}`,
    `Current title: ${profile?.current_job_title || ''}`,
    `Company: ${profile?.current_company || ''}`,
    `Years experience: ${profile?.years_of_experience ?? resume?.experience_years ?? ''}`,
    resumeBody,
  ].join('\n');
}
