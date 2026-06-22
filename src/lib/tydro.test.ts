import { describe, expect, it } from 'vitest';

import {
  getMerklBreakdownApr,
  getMerklForecastUsdMultiplier,
  convertMerklPointsAmountToUsd,
  safePointToUsdRate,
  getPointToUsdRate,
} from './tydro';
import type { MerklCampaignBreakdown } from '@/types/aave';

const baseBreakdown: MerklCampaignBreakdown = {
  campaignApr: 1,
  campaignStartedAt: '2026-01-01T00:00:00.000Z',
  campaignEndedAt: '2026-02-01T00:00:00.000Z',
  campaignId: '1',
};

describe('safePointToUsdRate', () => {
  it('passes through valid positive rate', () => {
    expect(safePointToUsdRate(1.5)).toBe(1.5);
  });

  it('passes through zero (user intent)', () => {
    expect(safePointToUsdRate(0)).toBe(0);
  });

  it('falls back to 0 for NaN', () => {
    expect(safePointToUsdRate(NaN)).toBe(0);
  });

  it('falls back to 0 for negative', () => {
    expect(safePointToUsdRate(-5)).toBe(0);
  });

  it('falls back to 0 for Infinity', () => {
    expect(safePointToUsdRate(Infinity)).toBe(0);
  });

  it('falls back to 0 for -Infinity', () => {
    expect(safePointToUsdRate(-Infinity)).toBe(0);
  });
});

describe('getPointToUsdRate', () => {
  const pointRateMap = { tydroinkpoints: 1.5 };

  it('returns rate for matching symbol (case-insensitive)', () => {
    expect(getPointToUsdRate('TydroInkPoints', pointRateMap)).toBe(1.5);
  });

  it('returns rate for lowercase symbol', () => {
    expect(getPointToUsdRate('tydroinkpoints', pointRateMap)).toBe(1.5);
  });

  it('returns 0 for unknown symbol', () => {
    expect(getPointToUsdRate('Gravity Points', pointRateMap)).toBe(0);
  });

  it('returns 0 for undefined symbol', () => {
    expect(getPointToUsdRate(undefined, pointRateMap)).toBe(0);
  });

  it('returns 0 for empty string symbol', () => {
    expect(getPointToUsdRate('', pointRateMap)).toBe(0);
  });

  it('returns 0 for empty pointRateMap', () => {
    expect(getPointToUsdRate('TydroInkPoints', {})).toBe(0);
  });
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
  it('prefers campaignApr over points when campaignApr is positive', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: 2.5,
      pointsPerThousandUsd: 2,
    });
    expect(apr).toBe(2.5);
  });

  it('uses points when campaignApr is zero and rate is positive', () => {
    const apr = getMerklBreakdownApr(
      {
        ...baseBreakdown,
        campaignApr: 0,
        pointsPerThousandUsd: 2,
      },
      1
    );
    expect(apr).toBe(73);
  });

  it('zeros out rewards when pointToUsdRate is zero', () => {
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

  it('zeros out rewards when pointToUsdRate is not provided (default 0)', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: 0,
      pointsPerThousandUsd: 2,
    });
    expect(apr).toBe(0);
  });

  it('coerces numeric string campaignApr when points are absent', () => {
    const apr = getMerklBreakdownApr({
      ...baseBreakdown,
      campaignApr: '4.2' as unknown as number,
    });
    expect(apr).toBe(4.2);
  });

  it('zeros out rewards for invalid pointToUsdRate (negative falls back to 0)', () => {
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

describe('convertMerklPointsAmountToUsd', () => {
  it('returns 0 when pointToUsdRate is zero', () => {
    expect(convertMerklPointsAmountToUsd(100, 0)).toBe(0);
  });

  it('returns 0 when pointToUsdRate is not provided (default 0)', () => {
    expect(convertMerklPointsAmountToUsd(100)).toBe(0);
  });

  it('converts with valid rate', () => {
    expect(convertMerklPointsAmountToUsd(100, 1.5)).toBe(150);
  });

  it('returns undefined for null amount', () => {
    expect(convertMerklPointsAmountToUsd(null, 1)).toBeUndefined();
  });

  it('returns undefined for undefined amount', () => {
    expect(convertMerklPointsAmountToUsd(undefined, 1)).toBeUndefined();
  });
});
