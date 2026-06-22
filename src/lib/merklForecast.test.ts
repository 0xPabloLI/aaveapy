import { describe, expect, it } from 'vitest';

import {
  deriveForecastProgressFlags,
  forecastWithTVL,
  merklAprCapPercentToForecastDecimal,
  type MerklForecastProgressState,
  type MerklForecastState,
} from './merklForecast';

const baseState: MerklForecastState = {
  campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  plannedDaily: 4000,
  requiredDaily: 4000,
  aprCap: 0.032,
  distributedSoFar: 42000,
  totalBudget: 100000,
  latestTvl: 10_000_000,
  endTimestamp: 1771000000,
};
const nowTs = 1_771_000_000;

describe('merklAprCapPercentToForecastDecimal', () => {
  it('maps API percent points to internal annual decimal', () => {
    expect(merklAprCapPercentToForecastDecimal(3.2)).toBeCloseTo(0.032, 10);
    expect(merklAprCapPercentToForecastDecimal(10)).toBeCloseTo(0.1, 10);
  });

  it('preserves null and undefined', () => {
    expect(merklAprCapPercentToForecastDecimal(null)).toBeNull();
    expect(merklAprCapPercentToForecastDecimal(undefined)).toBeUndefined();
  });
});

describe('forecastWithTVL', () => {
  it('returns PLANNED when requiredDaily equals plannedDaily', () => {
    const result = forecastWithTVL(baseState, 10_000_000_000, nowTs);

    expect(result.dailyRewards).toBeCloseTo(baseState.plannedDaily!, 6);
    expect(result.apr).toBeLessThan(0.001);
    expect(result.regime).toBe('PLANNED');
  });

  it('stays APR-capped when TVL is very small', () => {
    const result = forecastWithTVL(baseState, 1_000, nowTs);

    const expectedCapDaily = (1_000 * baseState.aprCap) / 365;
    expect(result.dailyRewards).toBeCloseTo(expectedCapDaily, 10);
    expect(result.apr).toBeCloseTo(baseState.aprCap, 10);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('returns zero rewards and apr when remaining budget is zero', () => {
    const noBudgetState: MerklForecastState = {
      ...baseState,
      plannedDaily: 0,
      requiredDaily: 0,
    };

    const result = forecastWithTVL(noBudgetState, 500_000, nowTs);

    expect(result.dailyRewards).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.regime).toBe('PLANNED');
  });

  it('detects CATCHING_UP when requiredDaily exceeds plannedDaily', () => {
    const catchingUpState: MerklForecastState = {
      ...baseState,
      plannedDaily: 4000,
      requiredDaily: 10000,
    };

    const result = forecastWithTVL(catchingUpState, 10_000_000_000, nowTs);

    expect(result.regime).toBe('CATCHING_UP');
  });

  it('uses no-cap model for DUTCH_AUCTION campaigns', () => {
    const dutchState: MerklForecastState = {
      ...baseState,
      campaignType: 'DUTCH_AUCTION',
      aprCap: null,
      plannedDaily: 500,
      requiredDaily: 500,
    };

    const result = forecastWithTVL(dutchState, 100_000, nowTs);

    expect(result.dailyRewards).toBe(500);
    expect(result.apr).toBeCloseTo((500 * 365) / 100_000, 10);
    expect(result.regime).toBe('PLANNED');
  });

  it('uses FIX_APR-driven daily rewards for FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE campaigns', () => {
    const fixState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const result = forecastWithTVL(fixState, 100_000, nowTs);
    const expectedDaily = (100_000 * 0.005) / 365;

    expect(result.dailyRewards).toBeCloseTo(expectedDaily, 10);
    expect(result.apr).toBeCloseTo(0.005, 10);
    expect(result.regime).toBe('PLANNED');
    expect(result.fixRewardableDays).toBeDefined();
    expect(result.fixRewardableUntilTs).toBeDefined();
  });

  it('treats FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE same as FIX_VALUE', () => {
    const fixAmountState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const fixValueState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const amountResult = forecastWithTVL(fixAmountState, 100_000, nowTs);
    const valueResult = forecastWithTVL(fixValueState, 100_000, nowTs);

    expect(amountResult.dailyRewards).toBeCloseTo(valueResult.dailyRewards, 10);
    expect(amountResult.apr).toBeCloseTo(valueResult.apr, 10);
    expect(amountResult.regime).toBe(valueResult.regime);
  });

  it('treats FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT same as FIX_VALUE', () => {
    const fixAmountPerAmountState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const fixValueState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const amountResult = forecastWithTVL(fixAmountPerAmountState, 100_000, nowTs);
    const valueResult = forecastWithTVL(fixValueState, 100_000, nowTs);

    expect(amountResult.dailyRewards).toBeCloseTo(valueResult.dailyRewards, 10);
    expect(amountResult.apr).toBeCloseTo(valueResult.apr, 10);
    expect(amountResult.regime).toBe(valueResult.regime);
  });

  it('treats MAX_REWARD_VALUE_PER_LIQUIDITY_AMOUNT same as MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE', () => {
    const maxAmountState: MerklForecastState = {
      ...baseState,
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_AMOUNT',
      plannedDaily: 4000,
      requiredDaily: 4000,
      aprCap: 0.032,
    };

    const maxValueState: MerklForecastState = {
      ...baseState,
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      plannedDaily: 4000,
      requiredDaily: 4000,
      aprCap: 0.032,
    };

    const amountResult = forecastWithTVL(maxAmountState, 1_000, nowTs);
    const valueResult = forecastWithTVL(maxValueState, 1_000, nowTs);

    expect(amountResult.dailyRewards).toBeCloseTo(valueResult.dailyRewards, 10);
    expect(amountResult.apr).toBeCloseTo(valueResult.apr, 10);
    expect(amountResult.regime).toBe(valueResult.regime);
  });

  it('routes TARGET_TOTAL_APR with MAX_APR budgetBoundMode to MAX path', () => {
    const targetTotalMaxState: MerklForecastState = {
      ...baseState,
      campaignType: 'TARGET_TOTAL_APR',
      budgetBoundMode: 'MAX_APR',
      aprCap: 0.047,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const maxState: MerklForecastState = {
      ...baseState,
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.047,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const targetResult = forecastWithTVL(targetTotalMaxState, 1_000, nowTs);
    const maxResult = forecastWithTVL(maxState, 1_000, nowTs);

    expect(targetResult.dailyRewards).toBeCloseTo(maxResult.dailyRewards, 10);
    expect(targetResult.apr).toBeCloseTo(maxResult.apr, 10);
    expect(targetResult.regime).toBe(maxResult.regime);
    expect(targetResult.fixRewardableDays).toBeUndefined();
  });

  it('routes TARGET_TOTAL_APR with FIX_APR budgetBoundMode to FIX path', () => {
    const targetTotalFixState: MerklForecastState = {
      ...baseState,
      campaignType: 'TARGET_TOTAL_APR',
      budgetBoundMode: 'FIX_APR',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const fixState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const targetResult = forecastWithTVL(targetTotalFixState, 100_000, nowTs);
    const fixResult = forecastWithTVL(fixState, 100_000, nowTs);

    expect(targetResult.dailyRewards).toBeCloseTo(fixResult.dailyRewards, 10);
    expect(targetResult.apr).toBeCloseTo(fixResult.apr, 10);
    expect(targetResult.regime).toBe(fixResult.regime);
    expect(targetResult.fixRewardableDays).toBeCloseTo(fixResult.fixRewardableDays!, 10);
  });

  it('treats TARGET_TOTAL_APR without budgetBoundMode as non-rate-limited (Dutch path)', () => {
    const targetTotalNoModeState: MerklForecastState = {
      ...baseState,
      campaignType: 'TARGET_TOTAL_APR',
      aprCap: 0.047,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const dutchState: MerklForecastState = {
      ...baseState,
      campaignType: 'DUTCH_AUCTION',
      aprCap: null,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
    };

    const targetResult = forecastWithTVL(targetTotalNoModeState, 1_000, nowTs);
    const dutchResult = forecastWithTVL(dutchState, 1_000, nowTs);

    expect(targetResult.dailyRewards).toBeCloseTo(dutchResult.dailyRewards, 10);
    expect(targetResult.apr).toBeCloseTo(dutchResult.apr, 10);
    expect(targetResult.regime).toBe(dutchResult.regime);
    expect(targetResult.fixRewardableDays).toBeUndefined();
  });

  it('shortens FIX rewardable window as TVL increases', () => {
    const fixState: MerklForecastState = {
      ...baseState,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 0.005,
      plannedDaily: 4_000,
      requiredDaily: 10_000,
      totalBudget: 120_000,
      distributedSoFar: 10_000,
      endTimestamp: nowTs + 20 * 86_400,
    };

    const lowTvl = forecastWithTVL(fixState, 200_000_000, nowTs);
    const highTvl = forecastWithTVL(fixState, 2_000_000_000, nowTs);

    expect(lowTvl.fixRewardableDays).toBeDefined();
    expect(highTvl.fixRewardableDays).toBeDefined();
    expect(highTvl.fixRewardableDays!).toBeLessThan(lowTvl.fixRewardableDays!);
    expect(highTvl.fixRewardableUntilTs!).toBeLessThan(lowTvl.fixRewardableUntilTs!);
  });

  it('falls back to plannedDaily when requiredDaily is missing', () => {
    const fallbackState: MerklForecastState = {
      ...baseState,
      requiredDaily: undefined,
    };

    const result = forecastWithTVL(fallbackState, 10_000_000_000, nowTs);
    expect(result.dailyRewards).toBeCloseTo(baseState.plannedDaily!, 10);
  });
});

describe('deriveForecastProgressFlags', () => {
  const progressState: MerklForecastProgressState = {
    ...baseState,
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
