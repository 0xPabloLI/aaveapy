import { describe, expect, it } from 'vitest';

import { forecastWithTVL, type MerklForecastState } from './merklForecast';

const baseState: MerklForecastState = {
  desiredDaily: 4000,
  remainingBudget: 24000,
  remainingDays: 6,
  maxAPR: 0.032,
  computedUntil: 1770274800,
  asOf: 1770279000,
  distributedSoFar: 42000,
};

describe('forecastWithTVL', () => {
  it('approaches desiredDaily and apr goes to zero when TVL is very large', () => {
    const result = forecastWithTVL(baseState, 10_000_000_000);

    expect(result.dailyRewards).toBeCloseTo(baseState.desiredDaily, 6);
    expect(result.apr).toBeLessThan(0.001);
    expect(result.capBinding).toBe(false);
    expect(result.regime).toBe('BUDGET_LIMITED');
  });

  it('stays APR-capped when TVL is very small', () => {
    const result = forecastWithTVL(baseState, 1_000);

    const expectedCapDaily = (1_000 * baseState.maxAPR) / 365;
    expect(result.dailyRewards).toBeCloseTo(expectedCapDaily, 10);
    expect(result.apr).toBeCloseTo(baseState.maxAPR, 10);
    expect(result.capBinding).toBe(true);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('returns zero rewards and apr when remaining budget is zero', () => {
    const noBudgetState: MerklForecastState = {
      ...baseState,
      desiredDaily: 0,
      remainingBudget: 0,
    };

    const result = forecastWithTVL(noBudgetState, 500_000);

    expect(result.dailyRewards).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.capBinding).toBe(false);
    expect(result.regime).toBe('BUDGET_LIMITED');
  });
});
