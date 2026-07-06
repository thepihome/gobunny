import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResumePlainText,
  metadataFromStructured,
  parseStructuredContent,
  sanitizeResumeForClient,
} from '../resumeContent.js';

test('buildResumePlainText uses content_text when present', () => {
  const text = buildResumePlainText({ content_text: 'Hello resume body' });
  assert.equal(text, 'Hello resume body');
});

test('buildResumePlainText flattens structured sections', () => {
  const structured = {
    summary: 'Engineer with 5 years experience',
    experience: [{ title: 'Dev', company: 'Acme', dates: '2020-2024', bullets: ['Built APIs'] }],
    skills: ['JavaScript'],
  };
  const text = buildResumePlainText({ structured_content: structured });
  assert.match(text, /Engineer with 5 years/);
  assert.match(text, /Dev at Acme/);
  assert.match(text, /JavaScript/);
});

test('metadataFromStructured extracts skills and summary', () => {
  const meta = metadataFromStructured({
    summary: 'Full stack dev',
    skills: ['React', 'Node'],
    experience: [],
    education: [{ degree: 'BS CS', school: 'State U', dates: '2018' }],
  });
  assert.deepEqual(meta.skills, ['React', 'Node']);
  assert.equal(meta.summary, 'Full stack dev');
  assert.match(meta.education, /BS CS/);
});

test('sanitizeResumeForClient parses JSON fields', () => {
  const row = sanitizeResumeForClient({
    skills: '["Go","Workers"]',
    structured_content: '{"summary":"Hi"}',
    ai_insights: '{"last_analysis":{"overall_score":80}}',
  });
  assert.deepEqual(row.skills, ['Go', 'Workers']);
  assert.equal(row.structured_content.summary, 'Hi');
  assert.equal(row.ai_insights.last_analysis.overall_score, 80);
});

test('buildResumePlainText prefers structured editor content over empty import', () => {
  const text = buildResumePlainText({
    content_text: '   ',
    structured_content: { summary: 'Engineer', experience: [], skills: ['Go'] },
  });
  assert.match(text, /Engineer/);
  assert.match(text, /Go/);
});
