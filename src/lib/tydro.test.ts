import { describe, expect, it } from 'vitest';

import {
  calculatePointsApr,
  convertMerklPointsAmountToUsd,
  getMerklBreakdownApr,
  getMerklForecastUsdMultiplier,
  getPointToUsdRate,
  buildPointRateMap,
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

  it('zeros out rewards for negative pointToUsdRate via fallback to 0', () => {
    const apr = getMerklBreakdownApr(
      {
        ...baseBreakdown,
        campaignApr: 0,
        pointsPerThousandUsd: 2,
      },
      -1
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

  it('returns 0 for NaN (invalid input fallback)', () => {
    expect(safePointToUsdRate(NaN)).toBe(0);
  });

  it('returns 0 for Infinity (invalid input fallback)', () => {
    expect(safePointToUsdRate(Infinity)).toBe(0);
  });

  it('returns 0 for negative (invalid input fallback)', () => {
    expect(safePointToUsdRate(-1)).toBe(0);
  });
});

describe('safePointToUsdRate (via public API)', () => {
  it('passes through zero rate — multiplier is 0', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      { ...baseBreakdown, pointsPerThousandUsd: 2 },
      0
    );
    expect(multiplier).toBe(0);
  });

  it('passes through positive rate — multiplier equals rate', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      { ...baseBreakdown, pointsPerThousandUsd: 2 },
      1.5
    );
    expect(multiplier).toBeCloseTo(1.5, 10);
  });

  it('falls back to 0 for NaN — multiplier is 0', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      { ...baseBreakdown, pointsPerThousandUsd: 2 },
      NaN
    );
    expect(multiplier).toBe(0);
  });

  it('falls back to 0 for negative — multiplier is 0', () => {
    const multiplier = getMerklForecastUsdMultiplier(
      { ...baseBreakdown, pointsPerThousandUsd: 2 },
      -5
    );
    expect(multiplier).toBe(0);
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

describe('getPointToUsdRate', () => {
  const rateMap = { tydroinkpoints: 1.5, 'gravity-points': 0.8 };

  it('returns rate for known symbol (case-insensitive)', () => {
    expect(getPointToUsdRate('TydroInkPoints', rateMap)).toBe(1.5);
    expect(getPointToUsdRate('TYDROINKPOINTS', rateMap)).toBe(1.5);
    expect(getPointToUsdRate('tydroinkpoints', rateMap)).toBe(1.5);
  });

  it('returns 0 for undefined symbol', () => {
    expect(getPointToUsdRate(undefined, rateMap)).toBe(0);
  });

  it('returns 0 for empty string symbol', () => {
    expect(getPointToUsdRate('', rateMap)).toBe(0);
  });

  it('returns 0 for known symbol not in map (AAV-898: unknown points token)', () => {
    expect(getPointToUsdRate('GravityPoints', rateMap)).toBe(0);
  });
});

describe('buildPointRateMap', () => {
  it('maps tydroinkpoints to the given rate', () => {
    const map = buildPointRateMap(2.5);
    expect(map.tydroinkpoints).toBe(2.5);
  });

  it('normalizes invalid rate to 0', () => {
    const map = buildPointRateMap(NaN);
    expect(map.tydroinkpoints).toBe(0);
  });

  it('preserves zero rate as explicit intent', () => {
    const map = buildPointRateMap(0);
    expect(map.tydroinkpoints).toBe(0);
  });
});
