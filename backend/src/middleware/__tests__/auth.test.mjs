import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('auth middleware', () => {
  it('authorize allows matching roles only', async () => {
    const { authorize } = await import('../auth.js');
    const admin = { id: 1, role: 'admin' };
    const candidate = { id: 2, role: 'candidate' };

    assert.equal(authorize('admin')(admin), null);
    assert.equal(authorize('admin')(candidate)?.status, 403);
    assert.equal(authorize('consultant', 'admin')(candidate)?.status, 403);
    assert.equal(authorize('consultant', 'admin')({ id: 3, role: 'consultant' }), null);
  });

  it('isSelfOrAdmin permits self or admin', async () => {
    const { isSelfOrAdmin } = await import('../auth.js');
    const candidate = { id: 5, role: 'candidate' };
    const admin = { id: 1, role: 'admin' };

    assert.equal(isSelfOrAdmin(candidate, '5'), true);
    assert.equal(isSelfOrAdmin(candidate, 5), true);
    assert.equal(isSelfOrAdmin(candidate, '99'), false);
    assert.equal(isSelfOrAdmin(admin, '99'), true);
  });
});
