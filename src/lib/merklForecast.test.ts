import { describe, expect, it } from 'vitest';

import { convertAprToApy, apyToApr } from '@/lib/rateCalculations';
import {
  deriveForecastProgressFlags,
  forecastMerklApr,
  forecastWithTVL,
  mergeForecastState,
  merklAprCapPercentToForecastDecimal,
  type MerklForecastProgressState,
  type MerklForecastState,
} from './merklForecast';
import type { MerklCampaignBreakdown, MerklForecastWireItem } from '@/types/aave';

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
      requiredDaily: undefined, // DUTCH — falls back to plannedDaily
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

  describe('ignoreCap option', () => {
    it('returns uncapped APR for MAX_REWARD when ignoreCap is true', () => {
      const result = forecastWithTVL(baseState, 1_000, nowTs);
      const uncapped = forecastWithTVL(baseState, 1_000, nowTs, { ignoreCap: true });

      expect(result.regime).toBe('APR_CAPPED');
      expect(result.apr).toBeCloseTo(baseState.aprCap!, 10);

      expect(uncapped.regime).not.toBe('APR_CAPPED');
      expect(uncapped.apr).toBeGreaterThan(result.apr);
      expect(uncapped.dailyRewards).toBeCloseTo(baseState.requiredDaily!, 10);
    });

    it('returns uncapped APR for TARGET_TOTAL_APR + MAX_APR when ignoreCap is true', () => {
      const state: MerklForecastState = {
        campaignType: 'TARGET_TOTAL_APR',
        aprCap: 0.047,
        nativeApyPercent: 3.0,
        budgetBoundMode: 'MAX_APR',
        plannedDaily: 4000,
        requiredDaily: 4000,
        latestTvl: 100_000,
        endTimestamp: nowTs + 30 * 86_400,
      };

      const result = forecastWithTVL(state, 100_000, nowTs);
      const uncapped = forecastWithTVL(state, 100_000, nowTs, { ignoreCap: true });

      expect(result.regime).toBe('APR_CAPPED');
      expect(uncapped.regime).not.toBe('APR_CAPPED');
      expect(uncapped.apr).toBeGreaterThan(result.apr);
    });

    it('does not affect FIX_REWARD campaigns', () => {
      const fixState: MerklForecastState = {
        ...baseState,
        campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        aprCap: 0.005,
      };

      const result = forecastWithTVL(fixState, 100_000, nowTs);
      const uncapped = forecastWithTVL(fixState, 100_000, nowTs, { ignoreCap: true });

      expect(uncapped.apr).toBeCloseTo(result.apr, 10);
      expect(uncapped.regime).toBe('PLANNED');
    });

    it('does not affect PLANNED regime when cap is not binding', () => {
      const result = forecastWithTVL(baseState, 10_000_000_000, nowTs);
      const uncapped = forecastWithTVL(baseState, 10_000_000_000, nowTs, { ignoreCap: true });

      expect(result.regime).toBe('PLANNED');
      expect(uncapped.regime).toBe('PLANNED');
      expect(uncapped.apr).toBeCloseTo(result.apr, 10);
    });
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

describe('forecastWithTVL — TARGET_TOTAL_APR', () => {
  const targetTotalAprBase: MerklForecastState = {
    campaignType: 'TARGET_TOTAL_APR',
    aprCap: 0.047, // 4.7% target APR in decimal
    nativeApyPercent: 3.0,
    budgetBoundMode: 'MAX_APR',
    plannedDaily: 4000,
    requiredDaily: 4000,
    distributedSoFar: 42000,
    totalBudget: 100000,
    latestTvl: 10_000_000,
    endTimestamp: nowTs + 30 * 86_400,
  };

  it('computes effectiveAprCap via APR→APY subtraction for MAX_APR', () => {
    const result = forecastWithTVL(targetTotalAprBase, 100_000, nowTs);

    const targetApyPercent = convertAprToApy(0.047 * 100);
    const effectiveApyPercent = Math.max(targetApyPercent - 3.0, 0);
    const effectiveAprCap = apyToApr(effectiveApyPercent) / 100;

    expect(result.apr).toBeCloseTo(effectiveAprCap, 4);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('computes effectiveAprCap and fixRewardableDays for FIX_APR', () => {
    const fixState: MerklForecastState = {
      ...targetTotalAprBase,
      budgetBoundMode: 'FIX_APR',
    };

    const result = forecastWithTVL(fixState, 100_000, nowTs);

    const targetApyPercent = convertAprToApy(0.047 * 100);
    const effectiveApyPercent = Math.max(targetApyPercent - 3.0, 0);
    const effectiveAprCap = apyToApr(effectiveApyPercent) / 100;

    expect(result.apr).toBeCloseTo(effectiveAprCap, 4);
    expect(result.regime).toBe('PLANNED');
    expect(result.fixRewardableDays).toBeDefined();
    expect(result.fixRewardableUntilTs).toBeDefined();
  });

  it('returns zero effectiveAprCap when nativeAPY >= targetAPR', () => {
    const noIncentiveState: MerklForecastState = {
      ...targetTotalAprBase,
      nativeApyPercent: 5.0, // native 5% > target 4.7%
    };

    const result = forecastWithTVL(noIncentiveState, 100_000, nowTs);

    expect(result.apr).toBe(0);
    expect(result.dailyRewards).toBe(0);
  });

  it('returns zero rewards when TVL is zero', () => {
    const result = forecastWithTVL(targetTotalAprBase, 0, nowTs);

    expect(result.dailyRewards).toBe(0);
    expect(result.apr).toBe(0);
    expect(result.regime).toBe('APR_CAPPED');
  });

  it('defaults nativeApyPercent to 0 when missing', () => {
    const noNativeState: MerklForecastState = {
      ...targetTotalAprBase,
      nativeApyPercent: undefined,
    };

    const result = forecastWithTVL(noNativeState, 100_000, nowTs);

    expect(result.apr).toBeCloseTo(0.047, 4);
  });

  it('detects CATCHING_UP for TARGET_TOTAL_APR + MAX_APR', () => {
    const catchingUpState: MerklForecastState = {
      ...targetTotalAprBase,
      plannedDaily: 1000,
      requiredDaily: 50000,
    };

    const result = forecastWithTVL(catchingUpState, 10_000_000_000, nowTs);

    expect(result.regime).toBe('CATCHING_UP');
  });
});

describe('forecastMerklApr — TARGET_TOTAL_APR', () => {
  const targetBreakdown: MerklCampaignBreakdown = {
    campaignApr: 1.7,
    campaignStartedAt: '2025-01-01',
    campaignEndedAt: '2026-12-31',
    campaignId: '13116567236794890552',
    campaignType: 'TARGET_TOTAL_APR',
    aprCap: 4.7,
    budgetBoundMode: 'MAX_APR',
    totalBudget: 100000,
    latestTvl: 10_000_000,
    plannedDaily: 500,
  };
  const emptyForecastStates: Record<string, MerklForecastWireItem> = {};

  it('returns 0 for TARGET_TOTAL_APR when campaignApr is 0', () => {
    const zeroBreakdown: MerklCampaignBreakdown = {
      ...targetBreakdown,
      campaignApr: 0,
    };

    const result = forecastMerklApr(zeroBreakdown, 0, emptyForecastStates, 1);

    expect(result).toBe(0);
  });

  it('returns campaignApr directly when positive and inputUsd is 0', () => {
    const result = forecastMerklApr(targetBreakdown, 0, emptyForecastStates, 1);

    expect(result).toBe(1.7);
  });

  it('uses forecastWithTVL with nativeApyPercent for scenario input', () => {
    const result = forecastMerklApr(targetBreakdown, 100_000, emptyForecastStates, 1, 3.0);

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(4.7);
  });
});

describe('mergeForecastState — nativeApyPercent passthrough', () => {
  const breakdown: MerklCampaignBreakdown = {
    campaignApr: 1.7,
    campaignStartedAt: '2025-01-01',
    campaignEndedAt: '2026-12-31',
    campaignId: 'test-campaign',
    campaignType: 'TARGET_TOTAL_APR',
    aprCap: 4.7,
    budgetBoundMode: 'MAX_APR',
  };
  const emptyForecastStates: Record<string, MerklForecastWireItem> = {};

  it('passes nativeApyPercent through to state', () => {
    const state = mergeForecastState(breakdown, emptyForecastStates, 1, 3.0);

    expect(state).not.toBeNull();
    expect(state!.nativeApyPercent).toBe(3.0);
  });

  it('passes budgetBoundMode from breakdown to state', () => {
    const state = mergeForecastState(breakdown, emptyForecastStates, 1);

    expect(state).not.toBeNull();
    expect(state!.budgetBoundMode).toBe('MAX_APR');
  });

  it('omits nativeApyPercent when not provided', () => {
    const state = mergeForecastState(breakdown, emptyForecastStates, 1);

    expect(state).not.toBeNull();
    expect(state!.nativeApyPercent).toBeUndefined();
  });
});

describe('mergeForecastState — null return conditions', () => {
  const emptyForecastStates: Record<string, MerklForecastWireItem> = {};

  it('returns null when campaignId is missing', () => {
    const breakdown = {
      campaignApr: 5,
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2026-12-31',
    } as unknown as MerklCampaignBreakdown;
    expect(mergeForecastState(breakdown, emptyForecastStates, 1)).toBeNull();
  });

  it('returns null when campaignType is missing', () => {
    const breakdown: MerklCampaignBreakdown = {
      campaignApr: 5,
      campaignId: 'test-campaign',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2026-12-31',
    };
    expect(mergeForecastState(breakdown, emptyForecastStates, 1)).toBeNull();
  });

  it('returns non-null when both campaignId and campaignType are present', () => {
    const breakdown: MerklCampaignBreakdown = {
      campaignApr: 5,
      campaignId: 'test-campaign',
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2026-12-31',
    };
    expect(mergeForecastState(breakdown, emptyForecastStates, 1)).not.toBeNull();
  });
});

describe('forecastMerklApr — fallback when mergeForecastState returns null', () => {
  const emptyForecastStates: Record<string, MerklForecastWireItem> = {};

  it('returns currentApr when mergeForecastState returns null (no campaignId)', () => {
    const breakdown = {
      campaignApr: 5,
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2026-12-31',
    } as unknown as MerklCampaignBreakdown;
    expect(forecastMerklApr(breakdown, 1000, emptyForecastStates, 1)).toBe(5);
  });

  it('returns currentApr when mergeForecastState returns null (no campaignType)', () => {
    const breakdown: MerklCampaignBreakdown = {
      campaignApr: 5,
      campaignId: 'test-campaign',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2026-12-31',
    };
    expect(forecastMerklApr(breakdown, 1000, emptyForecastStates, 1)).toBe(5);
  });
});
