import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../crypto.js';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret with JWT key material', async () => {
    const secret = 'test-jwt-secret-for-email';
    const plain = 'smtp-password-123';
    const enc = await encryptSecret(plain, secret);
    assert.ok(enc.startsWith('enc:'));
    const dec = await decryptSecret(enc, secret);
    assert.equal(dec, plain);
  });

  it('returns empty for empty input', async () => {
    assert.equal(await encryptSecret('', 'key'), '');
    assert.equal(await decryptSecret('', 'key'), '');
  });
});
