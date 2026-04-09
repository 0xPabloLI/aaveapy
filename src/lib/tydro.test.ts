import { describe, expect, it } from 'vitest';

import { getMerklBreakdownApr, getMerklForecastUsdMultiplier } from './tydro';
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

  it('uses default point rate when pointToUsdRate is zero (matches forecast multiplier fallback)', () => {
    const apr = getMerklBreakdownApr(
      {
        ...baseBreakdown,
        campaignApr: 0,
        pointsPerThousandUsd: 2,
      },
      0
    );
    expect(apr).toBe(73);
  });

  it('coerces numeric string campaignApr when points are absent', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: '4.2' as unknown as number,
    });
    expect(apr).toBe(4.2);
  });

  it('uses the Dutch auction plannedDaily fallback when points are present but invalid', () => {
    const apr = getMerklBreakdownApr(
      pointsAwareCampaign({
        campaignApr: 0,
        campaignType: 'DUTCH_AUCTION',
        pointsPerThousandUsd: 0,
        plannedDaily: 1,
        latestTvl: 100_000,
      }),
      2
    );
    expect(apr).toBeCloseTo(0.73, 10);
  });

  it('does not use the Dutch auction fallback for non-DUTCH campaigns', () => {
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

  it('keeps implied APR aligned with traditional points APR for a real points campaign fixture', () => {
    const breakdown = pointsAwareCampaign({
      campaignApr: 0,
      campaignType: 'DUTCH_AUCTION',
      plannedDaily: 11312,
      latestTvl: 23_586_552.55647095,
      pointsPerThousandUsd: 0.4795953106295122,
    });

    const impliedAprPercent = getMerklBreakdownApr(breakdown, 1);
    const traditionalPointsApr = 0.4795953106295122 * 36.5;

    expect(impliedAprPercent).toBeCloseTo(traditionalPointsApr, 10);
    expect(impliedAprPercent).toBeCloseTo(17.505228837977196, 10);
  });
});
