import { describe, expect, it } from 'vitest';
import { computePositionCapEligibility, computeBudgetRemainingDays, applyPositionCap } from './incentiveMath';

describe('computePositionCapEligibility', () => {
  it('returns eligibleUsd = min(position, cap) and isCapBinding when position > cap', () => {
    expect(computePositionCapEligibility(100, 50)).toEqual({
      eligibleUsd: 50,
      isCapBinding: true,
    });
  });

  it('returns full position when under cap', () => {
    expect(computePositionCapEligibility(30, 50)).toEqual({
      eligibleUsd: 30,
      isCapBinding: false,
    });
  });

  it('returns exact cap when equal', () => {
    expect(computePositionCapEligibility(50, 50)).toEqual({
      eligibleUsd: 50,
      isCapBinding: false,
    });
  });
});

describe('computeBudgetRemainingDays', () => {
  it('returns min(calendarDays, budgetDays) when budget is limiting', () => {
    expect(computeBudgetRemainingDays(1000, 100, 30)).toBeCloseTo(10, 5);
  });

  it('returns calendarDays when budget is abundant', () => {
    expect(computeBudgetRemainingDays(1_000_000, 100, 30)).toBe(30);
  });

  it('returns calendarDays when dailyReward is zero', () => {
    expect(computeBudgetRemainingDays(1000, 0, 30)).toBe(30);
  });

  it('returns calendarDays when remainingBudget is zero', () => {
    expect(computeBudgetRemainingDays(0, 100, 30)).toBe(30);
  });

  it('returns 0 when calendarDays is 0', () => {
    expect(computeBudgetRemainingDays(1000, 100, 0)).toBe(0);
  });

  it('handles budget exactly matching calendar window', () => {
    expect(computeBudgetRemainingDays(3000, 100, 30)).toBe(30);
  });
});

describe('applyPositionCap', () => {
  it('scales APR when position exceeds cap', () => {
    const result = applyPositionCap(10, 5000, 1000);
    expect(result.aprPercent).toBeCloseTo(2, 6);
    expect(result.isCapBinding).toBe(true);
    expect(result.eligibleUsd).toBe(1000);
  });

  it('returns unscaled APR when position is below cap', () => {
    const result = applyPositionCap(10, 500, 1000);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.eligibleUsd).toBe(500);
  });

  it('returns unscaled APR when position equals cap', () => {
    const result = applyPositionCap(10, 1000, 1000);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.eligibleUsd).toBe(1000);
  });

  it('handles zero position', () => {
    const result = applyPositionCap(10, 0, 1000);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.eligibleUsd).toBe(0);
  });
});
