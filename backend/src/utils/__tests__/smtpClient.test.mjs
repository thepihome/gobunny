import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSecureTransport } from '../smtpClient.js';

describe('resolveSecureTransport', () => {
  it('uses implicit TLS on port 465', () => {
    assert.equal(resolveSecureTransport(465, 'starttls'), 'on');
    assert.equal(resolveSecureTransport(465, 'ssl'), 'on');
  });

  it('uses STARTTLS on port 587 with starttls security', () => {
    assert.equal(resolveSecureTransport(587, 'starttls'), 'starttls');
    assert.equal(resolveSecureTransport(587, 'off'), 'starttls');
  });

  it('honours explicit ssl mode on non-465 ports when set', () => {
    assert.equal(resolveSecureTransport(2525, 'ssl'), 'on');
  });
});
