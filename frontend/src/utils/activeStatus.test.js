import { isActiveStatus } from './activeStatus';

describe('isActiveStatus', () => {
  it('returns true for active values', () => {
    expect(isActiveStatus(1)).toBe(true);
    expect(isActiveStatus(true)).toBe(true);
    expect(isActiveStatus('1')).toBe(true);
  });

  it('returns false for inactive or missing values', () => {
    expect(isActiveStatus(0)).toBe(false);
    expect(isActiveStatus(false)).toBe(false);
    expect(isActiveStatus('0')).toBe(false);
    expect(isActiveStatus(undefined)).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });
});
