/**
 * Unit tests for candidates filter functionality
 */

import { buildFilterConditions } from '../candidates.js';

describe('buildFilterConditions', () => {
  test('should handle empty filter conditions', () => {
    const result = buildFilterConditions([]);
    expect(result.whereConditions).toEqual([]);
    expect(result.params).toEqual([]);
  });

  test('should handle null filter conditions', () => {
    const result = buildFilterConditions(null);
    expect(result.whereConditions).toEqual([]);
    expect(result.params).toEqual([]);
  });

  test('should build text field LIKE condition', () => {
    const conditions = [
      { field: 'first_name', value: 'John', operator: 'like' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toContain('u.first_name LIKE ?');
    expect(result.params).toEqual(['%John%']);
  });

  test('should build text field exact match condition', () => {
    const conditions = [
      { field: 'email', value: 'test@example.com', operator: '=' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toBe('u.email = ?');
    expect(result.params).toEqual(['test@example.com']);
  });

  test('should build numeric field greater than condition', () => {
    const conditions = [
      { field: 'years_of_experience', value: '5', operator: '>' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toContain('cp.years_of_experience > ?');
    expect(result.params).toEqual([5]);
  });

  test('should build numeric field less than condition', () => {
    const conditions = [
      { field: 'years_of_experience', value: '10', operator: '<' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toContain('cp.years_of_experience < ?');
    expect(result.params).toEqual([10]);
  });

  test('should build boolean field true condition', () => {
    const conditions = [
      { field: 'is_active', value: 'true', operator: '=' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toBe('u.is_active = 1');
    expect(result.params).toEqual([]);
  });

  test('should build boolean field false condition', () => {
    const conditions = [
      { field: 'is_active', value: 'false', operator: '=' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(1);
    expect(result.whereConditions[0]).toContain('u.is_active = 0');
    expect(result.params).toEqual([]);
  });

  test('should handle multiple conditions', () => {
    const conditions = [
      { field: 'city', value: 'San Francisco', operator: 'like' },
      { field: 'years_of_experience', value: '3', operator: '>=' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(2);
    expect(result.params.length).toBe(2);
  });

  test('should skip invalid field names', () => {
    const conditions = [
      { field: 'invalid_field', value: 'test', operator: 'like' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(0);
  });

  test('should skip conditions with empty values', () => {
    const conditions = [
      { field: 'city', value: '', operator: 'like' },
      { field: 'city', value: '   ', operator: 'like' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(0);
  });

  test('should handle LIKE pattern with existing %', () => {
    const conditions = [
      { field: 'current_job_title', value: 'Data%', operator: 'like' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.params[0]).toBe('Data%');
  });

  test('should handle LIKE pattern without %', () => {
    const conditions = [
      { field: 'current_job_title', value: 'Data', operator: 'like' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.params[0]).toBe('%Data%');
  });

  test('should handle numeric field with invalid value', () => {
    const conditions = [
      { field: 'years_of_experience', value: 'invalid', operator: '>' }
    ];
    const result = buildFilterConditions(conditions);
    expect(result.whereConditions.length).toBe(0);
  });
});

