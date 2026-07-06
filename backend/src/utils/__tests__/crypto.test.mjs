import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createJWT,
  verifyJWT,
  hashPassword,
  comparePassword,
  needsPasswordRehash,
} from '../crypto.js';
import { calculateMatchScore, countSkillsMatch } from '../matchScore.js';

describe('crypto', () => {
  const secret = 'test-secret-key';

  it('creates and verifies JWT', async () => {
    const token = await createJWT({ userId: 42 }, secret, '1h');
    const payload = await verifyJWT(token, secret);
    assert.equal(payload.userId, 42);
  });

  it('rejects tampered JWT', async () => {
    const token = await createJWT({ userId: 42 }, secret, '1h');
    const parts = token.split('.');
    parts[1] = parts[1].slice(0, -2) + 'xx';
    assert.equal(await verifyJWT(parts.join('.'), secret), null);
  });

  it('hashes and verifies PBKDF2 password', async () => {
    const hash = await hashPassword('my-password');
    assert.ok(hash.startsWith('pbkdf2:'));
    assert.equal(await comparePassword('my-password', hash), true);
    assert.equal(await comparePassword('wrong', hash), false);
    assert.equal(needsPasswordRehash(hash), false);
  });

  it('supports legacy SHA-256 hashes', async () => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode('legacy'));
    const legacyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    assert.equal(await comparePassword('legacy', legacyHash), true);
    assert.equal(needsPasswordRehash(legacyHash), true);
  });
});

describe('matchScore', () => {
  it('scores skill overlap', () => {
    const resume = { skills: '["JavaScript","React"]', experience_years: 5 };
    const job = {
      required_skills: '["JavaScript","React","Node"]',
      preferred_skills: '[]',
      experience_level: 'senior',
    };
    assert.ok(calculateMatchScore(resume, job) >= 50);
    assert.equal(countSkillsMatch(resume, job), 2);
  });
});
