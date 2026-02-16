import { describe, expect, it } from 'vitest';

import {
  deriveForecastProgressFlags,
  forecastWithTVL,
  type MerklForecastProgressState,
  type MerklForecastState,
} from './merklForecast';

const baseState: MerklForecastState = {
  campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  plannedDaily: 4000,
  requiredDaily: 4000,
  remainingBudget: 24000,
  remainingDays: 6,
  maxAPR: 0.032,
  computedUntil: 1770274800,
  asOf: 1770279000,
  distributedSoFar: 42000,
  totalBudget: 100000,
  startTimestamp: 1770000000,
  endTimestamp: 1771000000,
};

describe('forecastWithTVL', () => {
  it('returns BUDGET_LIMITED when requiredDaily equals plannedDaily', () => {
    const result = forecastWithTVL(baseState, 10_000_000_000);

    expect(result.dailyRewards).toBeCloseTo(baseState.plannedDaily!, 6);
    expect(result.apr).toBeLessThan(0.001);
    expect(result.regime).toBe('BUDGET_LIMITED');
  });

  it('stays APR-capped when TVL is very small', () => {
    const result = forecastWithTVL(baseState, 1_000);

    const expectedCapDaily = (1_000 * baseState.maxAPR) / 365;
    expect(result.dailyRewards).toBeCloseTo(expectedCapDaily, 10);
    expect(result.apr).toBeCloseTo(baseState.maxAPR, 10);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('returns zero rewards and apr when remaining budget is zero', () => {
    const noBudgetState: MerklForecastState = {
      ...baseState,
      plannedDaily: 0,
      requiredDaily: 0,
      remainingBudget: 0,
    };

    const result = forecastWithTVL(noBudgetState, 500_000);

    expect(result.dailyRewards).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.regime).toBe('BUDGET_LIMITED');
  });

  it('detects CATCHING_UP when requiredDaily exceeds plannedDaily', () => {
    const catchingUpState: MerklForecastState = {
      ...baseState,
      plannedDaily: 4000,
      requiredDaily: 10000,
    };

    const result = forecastWithTVL(catchingUpState, 10_000_000_000);

    expect(result.regime).toBe('CATCHING_UP');
  });

  it('uses no-cap model for DUTCH_AUCTION campaigns', () => {
    const dutchState: MerklForecastState = {
      ...baseState,
      campaignType: 'DUTCH_AUCTION',
      maxAPR: null,
      plannedDaily: 500,
      requiredDaily: 500,
    };

    const result = forecastWithTVL(dutchState, 100_000);

    expect(result.dailyRewards).toBe(500);
    expect(result.apr).toBeCloseTo((500 * 365) / 100_000, 10);
    expect(result.regime).toBe('BUDGET_LIMITED');
  });

  it('applies rate limit for FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE campaigns', () => {
    const fixState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      maxAPR: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const result = forecastWithTVL(fixState, 100_000);
    const expectedDaily = (100_000 * 0.005) / 365;

    expect(result.dailyRewards).toBeCloseTo(expectedDaily, 10);
    expect(result.apr).toBeCloseTo(0.005, 10);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('falls back to plannedDaily when requiredDaily is missing', () => {
    const fallbackState: MerklForecastState = {
      ...baseState,
      requiredDaily: undefined,
    };

    const result = forecastWithTVL(fallbackState, 10_000_000_000);
    expect(result.dailyRewards).toBeCloseTo(baseState.plannedDaily!, 10);
  });
});

describe('deriveForecastProgressFlags', () => {
  const progressState: MerklForecastProgressState = {
    ...baseState,
    expectedByNow: 300_000,
    endTimestamp: 1_770_300_000,
  };

  it('does not set isUnderDistributed while campaign is active', () => {
    const flags = deriveForecastProgressFlags(
      {
        ...progressState,
        distributedSoFar: 250_000,
      },
      1_770_200_000
    );

    expect(flags.isUnderDistributed).toBe(false);
  });

  it('marks ended under-distributed campaigns', () => {
    const flags = deriveForecastProgressFlags(
      {
        ...progressState,
        totalBudget: 590_910.6,
        distributedSoFar: 547_837.39,
      },
      1_770_521_447
    );

    expect(flags.isUnderDistributed).toBe(true);
  });
});
