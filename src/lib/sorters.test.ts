import { describe, it, expect } from 'vitest';
import { compareIncentiveWithNative } from './sorters';

describe('compareIncentiveWithNative', () => {
  it('prioritizes pools with incentives over those without', () => {
    const result = compareIncentiveWithNative(1, 0, 1, 5, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('falls back to native sorting when both incentives are zero', () => {
    const result = compareIncentiveWithNative(0, 0, 5, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('uses native as a tie-breaker when incentives are equal', () => {
    const result = compareIncentiveWithNative(1, 1, 2, 5, 'desc');
    expect(result).toBeGreaterThan(0);
  });
});
