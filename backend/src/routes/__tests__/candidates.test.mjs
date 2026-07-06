import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let buildFilterConditions;

before(async () => {
  ({ buildFilterConditions } = await import('../candidates.js'));
});

describe('buildFilterConditions', () => {
  it('handles empty filter conditions', () => {
    const result = buildFilterConditions([]);
    assert.deepEqual(result.whereConditions, []);
    assert.deepEqual(result.params, []);
  });

  it('handles null filter conditions', () => {
    const result = buildFilterConditions(null);
    assert.deepEqual(result.whereConditions, []);
    assert.deepEqual(result.params, []);
  });

  it('builds text field LIKE condition', () => {
    const result = buildFilterConditions([{ field: 'first_name', value: 'John', operator: 'like' }]);
    assert.equal(result.whereConditions.length, 1);
    assert.ok(result.whereConditions[0].includes('u.first_name LIKE ?'));
    assert.deepEqual(result.params, ['%John%']);
  });

  it('builds text field exact match condition', () => {
    const result = buildFilterConditions([{ field: 'email', value: 'test@example.com', operator: '=' }]);
    assert.equal(result.whereConditions[0], 'u.email = ?');
    assert.deepEqual(result.params, ['test@example.com']);
  });

  it('builds numeric field greater than condition', () => {
    const result = buildFilterConditions([{ field: 'years_of_experience', value: '5', operator: '>' }]);
    assert.ok(result.whereConditions[0].includes('cp.years_of_experience > ?'));
    assert.deepEqual(result.params, [5]);
  });

  it('skips invalid field names', () => {
    const result = buildFilterConditions([{ field: 'invalid_field', value: 'test', operator: 'like' }]);
    assert.equal(result.whereConditions.length, 0);
  });
});
