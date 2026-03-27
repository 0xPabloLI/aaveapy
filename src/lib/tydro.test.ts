import { describe, expect, it } from 'vitest';

import { getMerklBreakdownApr, getMerklForecastUsdMultiplier } from './tydro';
import type { MerklCampaignBreakdown } from '@/types/aave';

const baseBreakdown: MerklCampaignBreakdown = {
  campaignApr: 1,
  campaignStartedAt: '2026-01-01T00:00:00.000Z',
  campaignEndedAt: '2026-02-01T00:00:00.000Z',
  campaignId: '1',
};

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
    // 2 points × $1/point × 36.5 (see calculateTydroApr in tydro.ts)
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
});
