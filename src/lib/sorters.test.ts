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

  it('sorts null incentive after non-null incentive', () => {
    const result = compareIncentiveWithNative(5, null, 1, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('sorts both null incentives by native fallback', () => {
    const result = compareIncentiveWithNative(null, null, 5, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('treats NaN incentive as null for sorting purposes', () => {
    const result = compareIncentiveWithNative(5, NaN, 1, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('treats Infinity incentive as null (not finite) for sorting purposes', () => {
    const result = compareIncentiveWithNative(Infinity, 5, 1, 2, 'desc');
    expect(result).toBeGreaterThan(0);
  });

  it('sorts null ahead of NaN (both treated as null, falls to native)', () => {
    const result = compareIncentiveWithNative(null, NaN, 5, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('handles both NaN incentives with native fallback', () => {
    const result = compareIncentiveWithNative(NaN, NaN, 5, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('sorts undefined incentive as null', () => {
    const result = compareIncentiveWithNative(5, undefined, 1, 2, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('keeps incentive-source priority over null incentive', () => {
    const result = compareIncentiveWithNative(null, 0, 1, 2, 'desc', true, false);
    expect(result).toBeLessThan(0);
  });

  it('falls back to native when both incentives are null and natives differ', () => {
    const result = compareIncentiveWithNative(null, null, 10, 5, 'desc');
    expect(result).toBeLessThan(0);
  });

  it('returns 0 when both incentives and natives are null', () => {
    const result = compareIncentiveWithNative(null, null, null, null, 'desc');
    expect(result).toBe(0);
  });
});
