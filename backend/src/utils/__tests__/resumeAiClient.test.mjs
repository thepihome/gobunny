import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, parseAiJsonResponse } from '../resumeAiClient.js';

test('extractJsonObject parses fenced JSON', () => {
  const obj = extractJsonObject('Here you go:\n```json\n{"score":82,"summary":"good fit"}\n```');
  assert.equal(obj.score, 82);
  assert.equal(obj.summary, 'good fit');
});

test('extractJsonObject parses JSON with trailing comma', () => {
  const obj = extractJsonObject('{"score":70,"keywords":["a","b",],}');
  assert.equal(obj.score, 70);
  assert.deepEqual(obj.keywords, ['a', 'b']);
});

test('extractJsonObject handles nested braces in strings', () => {
  const obj = extractJsonObject('{"summary":"Used {metrics} and scored 90","score":90}');
  assert.equal(obj.score, 90);
  assert.match(obj.summary, /metrics/);
});

test('parseAiJsonResponse returns ok false for plain text', () => {
  const r = parseAiJsonResponse('not json at all');
  assert.equal(r.ok, false);
});

test('parseAiJsonResponse accepts camelCase scores', () => {
  const r = parseAiJsonResponse('{"matchScore":65,"recommendation":"tailor_first"}');
  assert.equal(r.ok, true);
  assert.equal(r.parsed.matchScore, 65);
});
