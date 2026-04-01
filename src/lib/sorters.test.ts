import { describe, it, expect } from 'vitest';
import { compareIncentiveWithNative } from './sorters';

describe('compareIncentiveWithNative', () => {
  it('sorts by incentive value in descending order', () => {
    const result = compareIncentiveWithNative(1, 0, 1, 5, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('sorts by incentive value in ascending order', () => {
    const result = compareIncentiveWithNative(1, 0, 1, 5, 'asc');
    expect(result).toBeGreaterThan(0);
  });

  it('falls back to native sorting when incentives are equal', () => {
    const result = compareIncentiveWithNative(0, 0, 5, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('uses native as a tie-breaker when incentives are equal', () => {
    const result = compareIncentiveWithNative(1, 1, 2, 5, 'desc');
    expect(result).toBeGreaterThan(0);
  });

  it('keeps reserve with incentive source ahead even if displayed incentive is zero', () => {
    const result = compareIncentiveWithNative(0, 0, 1, 5, 'asc', true, false);
    expect(result).toBeLessThan(0);
  });
});
