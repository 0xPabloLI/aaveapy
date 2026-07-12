import { describe, expect, it } from 'vitest';

import { forecastMeritApr, getMeritCampaignCycleDays } from './meritForecast';

describe('forecastMeritApr', () => {
  it('uses anchor reserve TVL × APR when anchorTvlUsd is set', () => {
    const anchor = 9_000_000;
    const aprPct = 4;
    const deposit = 100_000;
    const result = forecastMeritApr({
      depositUsd: deposit,
      forecastAprPercent: aprPct,
      startDate: 'Thu Feb 26 2026',
      endDate: 'Thu Mar 12 2026',
      lastRoundRewardUsd: 10_628.27,
      anchorTvlUsd: anchor,
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      unavailable: false,
      estimateKind: 'TVL_DILUTION',
      meritEstimateSource: 'reserve_tvl',
      anchorTvlUsd: anchor,
    });
    const daily = (anchor * (aprPct / 100)) / 365;
    const hyp = anchor + deposit;
    expect(result?.apr).toBeCloseTo((daily * 365) / hyp, 10);
  });

  it('uses lastRoundRewardUsd for TVL dilution when no anchorTvlUsd', () => {
    const result = forecastMeritApr({
      depositUsd: 100_000,
      forecastAprPercent: 4,
      startDate: 'Thu Feb 26 2026',
      endDate: 'Thu Mar 12 2026',
      lastRoundRewardUsd: 10_000,
    });

    expect(result).not.toBeNull();
    expect(result?.estimateKind).toBe('TVL_DILUTION');
    expect(result?.meritEstimateSource).toBe('last_round');
  });

  it('falls back to current APR when no TVL data available', () => {
    const result = forecastMeritApr({
      depositUsd: 100_000,
      forecastAprPercent: 4.084439890516138,
      startDate: 'Thu Feb 26 2026',
      endDate: 'Thu Mar 12 2026',
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      unavailable: false,
      estimateKind: 'CURRENT_RATE',
      usesCurrentRateFallback: true,
    });
    expect(result?.apr).toBeCloseTo(0.04084439890516138, 12);
    expect(result?.dailyRewards).toBeCloseTo((100_000 * 0.04084439890516138) / 365, 10);
  });

  it('returns full APR without positionCap clip (positionCap handled by caller)', () => {
    const result = forecastMeritApr({
      depositUsd: 100_000,
      forecastAprPercent: 4,
    });

    expect(result).not.toBeNull();
    expect(result?.apr).toBeCloseTo(4 / 100, 10);
  });

  it('returns null for zero deposit', () => {
    const result = forecastMeritApr({
      depositUsd: 0,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for negative deposit', () => {
    const result = forecastMeritApr({
      depositUsd: -1000,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for zero APR', () => {
    const result = forecastMeritApr({
      depositUsd: 100_000,
      forecastAprPercent: 0,
    });
    expect(result).toBeNull();
  });
});

describe('getMeritCampaignCycleDays', () => {
  it('computes days between start and end date', () => {
    const days = getMeritCampaignCycleDays('2026-02-26', '2026-03-12');
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThan(0);
  });

  it('returns null for undefined dates', () => {
    expect(getMeritCampaignCycleDays(undefined, undefined)).toBeNull();
  });

  it('returns null when end is before start', () => {
    expect(getMeritCampaignCycleDays('2026-03-12', '2026-02-26')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(getMeritCampaignCycleDays('not-a-date', 'also-not-a-date')).toBeNull();
  });
});
