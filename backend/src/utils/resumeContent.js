/**
 * Resume content helpers — D1-first text and structured sections.
 */

export function emptyStructuredContent() {
  return {
    contact: { name: '', email: '', phone: '', linkedin: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
  };
}

export function parseStructuredContent(raw) {
  if (!raw) return emptyStructuredContent();
  if (typeof raw === 'object') return { ...emptyStructuredContent(), ...raw };
  try {
    const parsed = JSON.parse(raw);
    return { ...emptyStructuredContent(), ...parsed };
  } catch {
    return emptyStructuredContent();
  }
}

export function parseAiInsights(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseSkillsField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Flatten structured resume into plain text for AI prompts. */
function structuredHasBody(structured) {
  return Boolean(
    (structured.summary && structured.summary.trim()) ||
    (structured.experience?.length > 0) ||
    (structured.skills?.length > 0) ||
    (structured.education?.length > 0) ||
    (structured.contact?.name && structured.contact.name.trim())
  );
}

function textFromStructured(structured, resume) {
  const parts = [];
  if (structured.contact?.name) parts.push(`Name: ${structured.contact.name}`);
  if (structured.contact?.email) parts.push(`Email: ${structured.contact.email}`);
  if (structured.contact?.phone) parts.push(`Phone: ${structured.contact.phone}`);
  if (structured.summary) parts.push(`Summary:\n${structured.summary}`);
  for (const exp of structured.experience || []) {
    const header = `${exp.title || ''} at ${exp.company || ''} (${exp.dates || ''})`.trim();
    const bullets = (exp.bullets || []).filter(Boolean).map((b) => `- ${b}`);
    parts.push([header, ...bullets].filter(Boolean).join('\n'));
  }
  for (const edu of structured.education || []) {
    parts.push(`${edu.degree || ''} — ${edu.school || ''} (${edu.dates || ''})`.trim());
  }
  const skills = structured.skills?.length
    ? structured.skills
    : parseSkillsField(resume?.skills);
  if (skills.length) parts.push(`Skills: ${skills.join(', ')}`);
  if (resume?.education) parts.push(`Education: ${resume.education}`);
  if (!structured.summary && resume?.summary) parts.push(`Summary: ${resume.summary}`);
  return parts.filter(Boolean).join('\n\n');
}

export function buildResumePlainText(resume) {
  const structured = parseStructuredContent(resume?.structured_content);
  const contentText = (resume?.content_text || '').trim();
  const fromStructured = textFromStructured(structured, resume);

  if (fromStructured.trim()) {
    if (contentText && contentText.length > fromStructured.length * 0.5) {
      return `${fromStructured}\n\n--- Imported document ---\n${contentText}`.slice(0, 24000);
    }
    return fromStructured.slice(0, 24000);
  }

  if (contentText) return contentText.slice(0, 24000);

  const legacy = [];
  if (resume?.summary) legacy.push(`Summary: ${resume.summary}`);
  const skills = parseSkillsField(resume?.skills);
  if (skills.length) legacy.push(`Skills: ${skills.join(', ')}`);
  if (resume?.education) legacy.push(`Education: ${resume.education}`);
  return legacy.join('\n\n').slice(0, 24000);
}

/** Merge DB resume with optional request body draft fields. */
export function resolveDraftResume(resume, body = {}) {
  const hasStructuredDraft = body.structured_content != null;
  const structured = hasStructuredDraft
    ? parseStructuredContent(body.structured_content)
    : parseStructuredContent(resume?.structured_content);

  let contentText = (resume?.content_text || '').trim();
  if (body.content_text != null && String(body.content_text).trim()) {
    contentText = String(body.content_text).trim();
  }

  return {
    ...resume,
    structured_content: structured,
    content_text: contentText,
    skills: structured.skills?.length ? structured.skills : resume?.skills,
    summary: structured.summary || resume?.summary,
  };
}

/** Sync legacy columns from structured content for matching heuristics. */
export function metadataFromStructured(structured) {
  const s = parseStructuredContent(structured);
  const skills = Array.isArray(s.skills) ? s.skills.filter(Boolean) : [];
  let experienceYears = null;
  for (const exp of s.experience || []) {
    const m = String(exp.dates || '').match(/(\d{4})/g);
    if (m && m.length >= 2) {
      const span = parseInt(m[m.length - 1], 10) - parseInt(m[0], 10);
      if (span > 0) experienceYears = Math.max(experienceYears || 0, span);
    }
  }
  const education = (s.education || [])
    .map((e) => `${e.degree || ''} ${e.school || ''}`.trim())
    .filter(Boolean)
    .join('; ');
  return {
    skills,
    summary: s.summary || '',
    education,
    experience_years: experienceYears,
  };
}

export function sanitizeResumeForClient(resume) {
  if (!resume) return resume;
  const out = { ...resume };
  out.skills = parseSkillsField(out.skills);
  out.structured_content = parseStructuredContent(out.structured_content);
  out.ai_insights = parseAiInsights(out.ai_insights);
  return out;
}
