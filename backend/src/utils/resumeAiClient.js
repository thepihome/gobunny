/**
 * AI resume analysis, JD scoring, and editor suggestions.
 */

import { getAiMatchingConfig } from './appSettingsDb.js';
import { buildJobText, scoreMatchWithAi } from './aiMatchClient.js';
import { parseStructuredContent } from './resumeContent.js';

function clampScore(n) {
  if (n == null || n === '') return null;
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return null;
  return Math.max(0, Math.min(100, x));
}

function pickScore(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = clampScore(obj[k]);
    if (v != null) return v;
  }
  return null;
}

/** Balanced-brace JSON extraction (handles markdown fences, trailing commas, prose wrappers). */
export function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          try {
            return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
          } catch {
            return null;
          }
        }
      }
    }
  }

  // Truncated JSON — close open arrays/objects heuristically
  let partial = s.slice(start);
  partial = partial.replace(/,\s*$/g, '');
  const openBraces = (partial.match(/{/g) || []).length;
  const closeBraces = (partial.match(/}/g) || []).length;
  const openBrackets = (partial.match(/\[/g) || []).length;
  const closeBrackets = (partial.match(/]/g) || []).length;
  partial += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
  partial += '}'.repeat(Math.max(0, openBraces - closeBraces));
  try {
    return JSON.parse(partial.replace(/,\s*([}\]])/g, '$1'));
  } catch {
    return null;
  }
}

export function parseAiJsonResponse(text, fallback = {}) {
  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { parsed, ok: true, raw: String(text).slice(0, 500) };
  }
  return { parsed: fallback, ok: false, raw: String(text || '').slice(0, 500) };
}

async function callAiJson(env, prompt, maxTokens = 4096) {
  const config = await getAiMatchingConfig(env);
  const provider = config.provider;

  if (provider === 'openai') {
    const key = config.openai_api_key;
    const model = config.openai_model || 'gpt-4o-mini';
    if (!key) throw new Error('OpenAI API key not configured. Ask an admin to set AI keys in Settings.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const key = config.anthropic_api_key;
    const model = config.anthropic_model || 'claude-3-5-sonnet-20241022';
    if (!key) throw new Error('Anthropic API key not configured. Ask an admin to set AI keys in Settings.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  if (provider === 'gemini') {
    const key = config.gemini_api_key;
    const model = config.gemini_model || 'gemini-1.5-flash';
    if (!key) throw new Error('Gemini API key not configured. Ask an admin to set AI keys in Settings.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked response: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.length) {
      const reason = candidate?.finishReason || 'unknown';
      throw new Error(`Gemini empty response (finishReason: ${reason})`);
    }
    return candidate.content.parts.map((p) => p.text || '').join('');
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

const ANALYZE_PROMPT = (text) => `You are an expert career coach. Analyze this resume.

Respond with a single JSON object only, no markdown:
{"overall_score":72,"ats_score":68,"strengths":["strength1","strength2"],"gaps":["gap1"],"ats_tips":["tip1"],"section_scores":{"summary":70,"experience":75,"skills":65,"education":80},"summary":"one sentence"}

Use integer scores 0-100 based on actual content quality.

RESUME:
${text.slice(0, 14000)}`;

const SCORE_JD_PROMPT = (resumeText, jdText) => `You are an expert recruiter. Score resume fit vs job (0-100).

Respond with a single JSON object only, no markdown:
{"score":78,"recommendation":"tailor_first","matched_keywords":["kw1","kw2"],"missing_keywords":["kw3"],"strengths_for_role":["s1"],"gaps_for_role":["g1"],"tailoring_tips":["tip1"],"summary":"one sentence"}

recommendation must be apply, tailor_first, or skip.

JOB:
${jdText.slice(0, 7000)}

RESUME:
${resumeText.slice(0, 10000)}`;

const SCORE_KEYWORDS_PROMPT = (resumeText, jdText, score) => `Given match score ${score}, list keywords for this resume vs job.

Respond with JSON only:
{"matched_keywords":[""],"missing_keywords":[""],"tailoring_tips":[""],"gaps_for_role":[""]}

JOB:
${jdText.slice(0, 5000)}

RESUME:
${resumeText.slice(0, 8000)}`;

const PARSE_PROMPT = (text) => `Extract resume into JSON only:
{"contact":{"name":"","email":"","phone":"","linkedin":""},"summary":"","experience":[{"id":"exp1","title":"","company":"","dates":"","bullets":[""]}],"education":[{"id":"edu1","degree":"","school":"","dates":""}],"skills":[],"certifications":[]}

Use ids exp1, exp2, edu1. Do not invent facts.

TEXT:
${text.slice(0, 12000)}`;

function buildSuggestionsPrompt(text, structured, section, jobContext) {
  const ctx = jobContext ? `\nJOB:\n${jobContext.slice(0, 3000)}\n` : '';
  const structSlice = JSON.stringify(structured).slice(0, 6000);
  return `Suggest resume fixes. Use exact item_id from structured JSON for experience/education.

Respond with JSON only:
{"suggestions":[{"section":"summary","item_id":null,"exp_index":null,"bullet_index":null,"field":"summary","issue":"issue","suggestion":"fix","proposed_text":"rewrite text","severity":"high"}]}

Focus: ${section || 'all'}. Include at least 3 suggestions if issues exist.${ctx}

STRUCTURED:
${structSlice}

TEXT:
${text.slice(0, 6000)}`;
}

function recommendationFromScore(score) {
  if (score >= 75) return 'apply';
  if (score >= 45) return 'tailor_first';
  return 'skip';
}

function normalizeScoreResult(obj, baseScore, baseSummary) {
  const score = pickScore(obj, 'score', 'match_score', 'matchScore', 'overall_score') ?? baseScore ?? 0;
  return {
    score,
    recommendation: ['apply', 'tailor_first', 'skip'].includes(obj?.recommendation)
      ? obj.recommendation
      : recommendationFromScore(score),
    matched_keywords: Array.isArray(obj?.matched_keywords || obj?.matchedKeywords)
      ? (obj.matched_keywords || obj.matchedKeywords).filter(Boolean).slice(0, 20)
      : [],
    missing_keywords: Array.isArray(obj?.missing_keywords || obj?.missingKeywords)
      ? (obj.missing_keywords || obj.missingKeywords).filter(Boolean).slice(0, 20)
      : [],
    strengths_for_role: Array.isArray(obj?.strengths_for_role || obj?.strengthsForRole)
      ? (obj.strengths_for_role || obj.strengthsForRole).filter(Boolean).slice(0, 8)
      : [],
    gaps_for_role: Array.isArray(obj?.gaps_for_role || obj?.gapsForRole)
      ? (obj.gaps_for_role || obj.gapsForRole).filter(Boolean).slice(0, 8)
      : [],
    tailoring_tips: Array.isArray(obj?.tailoring_tips || obj?.tailoringTips)
      ? (obj.tailoring_tips || obj.tailoringTips).filter(Boolean).slice(0, 8)
      : baseSummary
        ? [baseSummary]
        : [],
    summary: String(obj?.summary || baseSummary || '').slice(0, 500),
    scored_at: new Date().toISOString(),
  };
}

export async function analyzeResumeWithAi(env, resumeText) {
  if (!resumeText?.trim()) {
    throw new Error('Resume text is empty — add content in the editor first.');
  }

  let obj = null;
  try {
    const raw = await callAiJson(env, ANALYZE_PROMPT(resumeText));
    const { parsed, ok } = parseAiJsonResponse(raw, {});
    if (ok) obj = parsed;
    else console.warn('Analyze JSON parse failed:', raw?.slice(0, 300));
  } catch (e) {
    console.warn('Analyze AI call failed:', e.message);
  }

  if (!obj) {
    const config = await getAiMatchingConfig(env);
    const base = await scoreMatchWithAi(
      { provider: config.provider, config },
      'General professional role requiring clear experience, skills, and measurable achievements.',
      resumeText
    );
    const overall = base.score || 50;
    return {
      overall_score: overall,
      ats_score: overall,
      strengths: base.summary ? [base.summary] : ['Resume content provided for review'],
      gaps: ['Run analysis again after adding more detail to experience bullets'],
      ats_tips: ['Use measurable outcomes in bullet points', 'Mirror keywords from target job descriptions'],
      section_scores: {},
      summary: base.summary || 'Analysis used simplified scoring — add more detail for richer feedback.',
      analyzed_at: new Date().toISOString(),
    };
  }

  const overall = pickScore(obj, 'overall_score', 'overallScore', 'score') ?? 0;
  const ats = pickScore(obj, 'ats_score', 'atsScore', 'overall_score', 'overallScore') ?? overall;

  return {
    overall_score: overall,
    ats_score: ats,
    strengths: Array.isArray(obj.strengths) ? obj.strengths.filter(Boolean).slice(0, 8) : [],
    gaps: Array.isArray(obj.gaps) ? obj.gaps.filter(Boolean).slice(0, 8) : [],
    ats_tips: Array.isArray(obj.ats_tips || obj.atsTips) ? (obj.ats_tips || obj.atsTips).slice(0, 8) : [],
    section_scores: obj.section_scores || obj.sectionScores || {},
    summary: String(obj.summary || '').slice(0, 500),
    analyzed_at: new Date().toISOString(),
  };
}

export async function scoreResumeAgainstJd(env, resumeText, jdText) {
  if (!resumeText?.trim()) throw new Error('Resume text is empty');
  if (!jdText?.trim()) throw new Error('Job description is empty');

  const config = await getAiMatchingConfig(env);
  const provider = config.provider;

  // Proven scorer — always succeeds when API key is valid
  const base = await scoreMatchWithAi({ provider, config }, jdText, resumeText);

  let obj = null;
  try {
    const raw = await callAiJson(env, SCORE_JD_PROMPT(resumeText, jdText));
    const { parsed, ok } = parseAiJsonResponse(raw, {});
    if (ok && pickScore(parsed, 'score', 'match_score') != null) {
      obj = parsed;
    } else {
      console.warn('Rich score JSON parse failed, using base scorer. Sample:', raw?.slice(0, 300));
    }
  } catch (e) {
    console.warn('Rich score AI call failed:', e.message);
  }

  let result = normalizeScoreResult(obj || {}, base.score, base.summary);

  // Enrich keywords if rich parse missed them
  if (result.matched_keywords.length === 0 && result.missing_keywords.length === 0) {
    try {
      const rawKw = await callAiJson(env, SCORE_KEYWORDS_PROMPT(resumeText, jdText, result.score), 2048);
      const { parsed: kw, ok } = parseAiJsonResponse(rawKw, {});
      if (ok) {
        result = {
          ...result,
          matched_keywords: Array.isArray(kw.matched_keywords) ? kw.matched_keywords.slice(0, 20) : [],
          missing_keywords: Array.isArray(kw.missing_keywords) ? kw.missing_keywords.slice(0, 20) : [],
          gaps_for_role: Array.isArray(kw.gaps_for_role) ? kw.gaps_for_role.slice(0, 8) : result.gaps_for_role,
          tailoring_tips: Array.isArray(kw.tailoring_tips) ? kw.tailoring_tips.slice(0, 8) : result.tailoring_tips,
        };
      }
    } catch (e) {
      console.warn('Keyword enrichment failed:', e.message);
    }
  }

  return result;
}

export async function parseResumeTextWithAi(env, text) {
  const raw = await callAiJson(env, PARSE_PROMPT(text), 4096);
  const { parsed: obj, ok } = parseAiJsonResponse(raw, {});
  if (!ok) throw new Error('Parse: could not read AI response — try again or edit sections manually.');
  return {
    contact: obj.contact || { name: '', email: '', phone: '', linkedin: '' },
    summary: obj.summary || '',
    experience: Array.isArray(obj.experience) ? obj.experience : [],
    education: Array.isArray(obj.education) ? obj.education : [],
    skills: Array.isArray(obj.skills) ? obj.skills.filter(Boolean) : [],
    certifications: Array.isArray(obj.certifications) ? obj.certifications : [],
  };
}

export async function getResumeEditorSuggestions(env, resumeText, structuredRaw, section, jobDescription) {
  const structured = parseStructuredContent(structuredRaw);

  let obj = { suggestions: [] };
  try {
    const raw = await callAiJson(
      env,
      buildSuggestionsPrompt(resumeText, structured, section, jobDescription),
      4096
    );
    const { parsed, ok } = parseAiJsonResponse(raw, { suggestions: [] });
    if (ok) obj = parsed;
    else console.warn('Suggestions JSON parse failed:', raw?.slice(0, 300));
  } catch (e) {
    console.warn('Suggestions AI call failed:', e.message);
  }

  // Fallback suggestions from score gaps if empty
  if (!Array.isArray(obj.suggestions) || obj.suggestions.length === 0) {
    if (jobDescription?.trim() && resumeText?.trim()) {
      try {
        const config = await getAiMatchingConfig(env);
        const base = await scoreMatchWithAi({ provider: config.provider, config }, jobDescription, resumeText);
        if (base.summary) {
          obj.suggestions = [
            {
              section: 'summary',
              item_id: null,
              exp_index: null,
              bullet_index: null,
              field: 'summary',
              issue: `Overall match is ${base.score}/100 for this role`,
              suggestion: base.summary,
              proposed_text: '',
              severity: base.score < 60 ? 'high' : 'medium',
            },
          ];
        }
      } catch {
        /* ignore */
      }
    }
  }

  const suggestions = Array.isArray(obj.suggestions) ? obj.suggestions : [];
  return {
    suggestions: suggestions.slice(0, 20).map((s, idx) => ({
      section: s.section || 'summary',
      item_id: s.item_id ?? null,
      exp_index: s.exp_index ?? s.expIndex ?? null,
      bullet_index: s.bullet_index ?? s.bulletIndex ?? null,
      field: s.field || s.section || '',
      issue: String(s.issue || 'Improve this section').slice(0, 300),
      suggestion: String(s.suggestion || '').slice(0, 500),
      proposed_text: String(s.proposed_text || s.proposedText || '').slice(0, 1000),
      severity: ['high', 'medium', 'low'].includes(s.severity) ? s.severity : 'medium',
      id: `sug-${idx}`,
    })),
    generated_at: new Date().toISOString(),
  };
}

export async function buildJdTextFromJob(env, jobId) {
  const { queryOne } = await import('./db.js');
  const job = await queryOne(
    env,
    `SELECT j.*, jr.name as job_classification_name FROM jobs j
     LEFT JOIN job_roles jr ON j.job_classification = jr.id WHERE j.id = ?`,
    [jobId]
  );
  if (!job) return null;
  if (job.required_skills) {
    try {
      job.required_skills = JSON.parse(job.required_skills);
    } catch {
      job.required_skills = [];
    }
  }
  if (job.preferred_skills) {
    try {
      job.preferred_skills = JSON.parse(job.preferred_skills);
    } catch {
      job.preferred_skills = [];
    }
  }
  return buildJobText(job);
}
