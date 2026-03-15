import { describe, expect, it } from 'vitest';

import { getMerklForecastUsdMultiplier } from './tydro';
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
