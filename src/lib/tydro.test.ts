import { describe, expect, it } from 'vitest';

import {
  calculatePointsApr,
  convertMerklPointsAmountToUsd,
  getMerklBreakdownApr,
  getMerklForecastUsdMultiplier,
  safePointToUsdRate,
} from './tydro';
import type { MerklCampaignBreakdown } from '@/types/aave';

const baseBreakdown: MerklCampaignBreakdown = {
  campaignApr: 1,
  campaignStartedAt: '2026-01-01T00:00:00.000Z',
  campaignEndedAt: '2026-02-01T00:00:00.000Z',
  campaignId: '1',
}; 

const pointsAwareCampaign = (overrides: Partial<MerklCampaignBreakdown>): MerklCampaignBreakdown => ({
  ...baseBreakdown,
  ...overrides,
});

describe('getMerklForecastUsdMultiplier', () => {
  it('returns selected rate multiplier for point-based campaigns', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      {
        ...baseBreakdown,
        pointsPerThousandUsd: 2,
      },
      1.8
    );

    expect(multiplier).toBeCloseTo(1.8, 10);
  });

  it('returns 1 for non-point campaigns', () => {
    const multiplier = getMerklForecastUsdMultiplier(baseBreakdown, 3);
    expect(multiplier).toBe(1);
  });

  it('returns 0 multiplier when pointToUsdRate is zero', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      {
        ...baseBreakdown,
        pointsPerThousandUsd: 2,
      },
      0
    );
    expect(multiplier).toBe(0);
  });
});

describe('getMerklBreakdownApr', () => {
  it('prefers campaignApr over Tydro points when campaignApr is positive', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: 2.5,
      pointsPerThousandUsd: 2,
    });
    expect(apr).toBe(2.5);
  });

  it('uses Tydro points when campaignApr is zero', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: 0,
      pointsPerThousandUsd: 2,
    });
    // 2 points × $1/point × 36.5 (see calculatePointsApr in tydro.ts)
    expect(apr).toBe(73);
  });

  it('zeros out rewards when pointToUsdRate is zero (user explicitly set $0/INK)', () => {
    const apr = getMerklBreakdownApr(
      {
        ...baseBreakdown,
        campaignApr: 0,
        pointsPerThousandUsd: 2,
      },
      0
    );
    expect(apr).toBe(0);
  });

  it('coerces numeric string campaignApr when points are absent', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: '4.2' as unknown as number,
    });
    expect(apr).toBe(4.2);
  });

  it('returns 0 for non-DUTCH campaigns without campaignApr or points', () => {
    const apr = getMerklBreakdownApr(
      pointsAwareCampaign({
        campaignApr: 0,
        campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        pointsPerThousandUsd: 0,
        plannedDaily: 1,
        latestTvl: 100_000,
      })
    );
    expect(apr).toBe(0);
  });
});

describe('safePointToUsdRate', () => {
  it('returns the rate when positive', () => {
    expect(safePointToUsdRate(1.5)).toBe(1.5);
  });

  it('returns 0 when rate is zero (explicit user intent to zero out)', () => {
    expect(safePointToUsdRate(0)).toBe(0);
  });

  it('returns default for NaN', () => {
    expect(safePointToUsdRate(NaN)).toBe(1);
  });

  it('returns default for Infinity', () => {
    expect(safePointToUsdRate(Infinity)).toBe(1);
  });

  it('returns default for negative', () => {
    expect(safePointToUsdRate(-1)).toBe(1);
  });
});

describe('calculatePointsApr with zero rate', () => {
  it('returns 0 when pointToUsdRate is zero', () => {
    expect(calculatePointsApr(2, 0)).toBe(0);
  });
});

describe('convertMerklPointsAmountToUsd with zero rate', () => {
  it('returns 0 when pointToUsdRate is zero', () => {
    expect(convertMerklPointsAmountToUsd(100, 0)).toBe(0);
  });
});
