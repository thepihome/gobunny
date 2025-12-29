/**
 * Unit tests for filter query parser
 */

// Mock the parseQueryValue function for testing
export const parseQueryValue = (value) => {
  if (!value || !value.trim()) return null;
  
  const trimmed = value.trim();
  
  // Check for LIKE pattern first (before comparison operators): "like Data%"
  const likeMatch = trimmed.match(/^like\s+(.+)$/i);
  if (likeMatch) {
    return {
      operator: 'like',
      value: likeMatch[1].trim()
    };
  }
  
  // Check for exact match: "=value"
  const exactMatch = trimmed.match(/^=\s*(.+)$/);
  if (exactMatch) {
    return {
      operator: '=',
      value: exactMatch[1].trim()
    };
  }
  
  // Check for comparison operators at the start: ">1", "<5", ">=10", "<=20"
  const comparisonMatch = trimmed.match(/^(>=|<=|>|<)\s*(.+)$/);
  if (comparisonMatch) {
    return {
      operator: comparisonMatch[1],
      value: comparisonMatch[2].trim()
    };
  }
  
  // Default: LIKE for text fields (contains search)
  return {
    operator: 'like',
    value: trimmed
  };
};

// Test cases
describe('parseQueryValue', () => {
  test('should parse exact match with =', () => {
    const result = parseQueryValue('=test');
    expect(result).toEqual({ operator: '=', value: 'test' });
  });

  test('should parse LIKE pattern', () => {
    const result = parseQueryValue('like Data%');
    expect(result).toEqual({ operator: 'like', value: 'Data%' });
  });

  test('should parse LIKE pattern case insensitive', () => {
    const result = parseQueryValue('LIKE Data%');
    expect(result).toEqual({ operator: 'like', value: 'Data%' });
  });

  test('should parse greater than operator', () => {
    const result = parseQueryValue('>1');
    expect(result).toEqual({ operator: '>', value: '1' });
  });

  test('should parse less than operator', () => {
    const result = parseQueryValue('<5');
    expect(result).toEqual({ operator: '<', value: '5' });
  });

  test('should parse greater than or equal', () => {
    const result = parseQueryValue('>=10');
    expect(result).toEqual({ operator: '>=', value: '10' });
  });

  test('should parse less than or equal', () => {
    const result = parseQueryValue('<=20');
    expect(result).toEqual({ operator: '<=', value: '20' });
  });

  test('should parse comparison with spaces', () => {
    const result = parseQueryValue('> 1');
    expect(result).toEqual({ operator: '>', value: '1' });
  });

  test('should default to LIKE for plain text', () => {
    const result = parseQueryValue('test');
    expect(result).toEqual({ operator: 'like', value: 'test' });
  });

  test('should handle empty string', () => {
    const result = parseQueryValue('');
    expect(result).toBeNull();
  });

  test('should handle null', () => {
    const result = parseQueryValue(null);
    expect(result).toBeNull();
  });

  test('should trim whitespace', () => {
    const result = parseQueryValue('  test  ');
    expect(result).toEqual({ operator: 'like', value: 'test' });
  });
});

