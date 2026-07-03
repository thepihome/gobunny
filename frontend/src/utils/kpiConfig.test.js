import { parseQueryConfig, stringifyQueryConfig } from './kpiConfig';

describe('parseQueryConfig', () => {
  test('returns null for empty input', () => {
    expect(parseQueryConfig(null)).toBeNull();
    expect(parseQueryConfig(undefined)).toBeNull();
    expect(parseQueryConfig('')).toBeNull();
  });

  test('returns object as-is', () => {
    const obj = { type: 'candidate_filter', conditions: [] };
    expect(parseQueryConfig(obj)).toEqual(obj);
  });

  test('parses JSON string', () => {
    const obj = { type: 'candidate_filter', conditions: [{ field: 'city', value: 'Austin' }] };
    expect(parseQueryConfig(JSON.stringify(obj))).toEqual(obj);
  });

  test('parses double-encoded JSON string', () => {
    const obj = { type: 'candidate_filter' };
    const double = JSON.stringify(JSON.stringify(obj));
    expect(parseQueryConfig(double)).toEqual(obj);
  });

  test('returns null for invalid JSON', () => {
    expect(parseQueryConfig('{invalid')).toBeNull();
  });
});

describe('stringifyQueryConfig', () => {
  test('returns null for empty input', () => {
    expect(stringifyQueryConfig(null)).toBeNull();
  });

  test('returns string as-is', () => {
    expect(stringifyQueryConfig('{"a":1}')).toBe('{"a":1}');
  });

  test('stringifies object', () => {
    expect(stringifyQueryConfig({ a: 1 })).toBe('{"a":1}');
  });
});

describe('buildKpiNavigateUrl logic', () => {
  function buildKpiNavigateUrl(config) {
    if (!config || config.type !== 'candidate_filter') return null;
    const params = new URLSearchParams();
    if (config.conditions?.length) {
      params.set('query', encodeURIComponent(JSON.stringify(config.conditions)));
    }
    return params.toString() ? `/candidates?${params.toString()}` : null;
  }

  test('builds candidates URL from conditions', () => {
    const config = {
      type: 'candidate_filter',
      conditions: [{ field: 'city', value: 'Austin', operator: 'like' }],
    };
    const url = buildKpiNavigateUrl(config);
    expect(url).toContain('/candidates?');
    expect(url).toContain('query=');
  });

  test('returns null for non-filter config', () => {
    expect(buildKpiNavigateUrl({ type: 'other' })).toBeNull();
  });
});
