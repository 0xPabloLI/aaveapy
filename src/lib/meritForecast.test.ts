import { describe, expect, it } from 'vitest';

import { extractMeritSelfCapUsd, forecastMeritCampaign, getMeritCampaignCycleDays } from './meritForecast';

describe('extractMeritSelfCapUsd', () => {
  it('parses the Self-auth cap from structured Merit messages', () => {
    const cap = extractMeritSelfCapUsd([
      {
        action: 'Self Authentication',
        description:
          'Supply USDT and double your yield by verifying your humanity through Self for the first $1000 USDT supplied per user.',
      },
    ]);

    expect(cap).toBe(1000);
  });

  it('returns null when message has no Self reference', () => {
    const cap = extractMeritSelfCapUsd([
      { action: 'Base Reward', description: 'Standard merit reward.' },
    ]);
    expect(cap).toBeNull();
  });

  it('returns null for undefined message', () => {
    expect(extractMeritSelfCapUsd(undefined)).toBeNull();
  });

  it('parses cap with comma-separated thousands when self and amount are on same line', () => {
    const cap = extractMeritSelfCapUsd([
      'Self Authentication: Supply and double your yield for the first $10,000 USDT supplied per user.',
    ]);
    expect(cap).toBe(10000);
  });
});

describe('forecastMeritCampaign', () => {
  it('uses anchor reserve TVL × APR when anchorTvlUsd is set (before last round)', () => {
    const anchor = 9_000_000;
    const aprPct = 4;
    const deposit = 100_000;
    const result = forecastMeritCampaign({
      mode: 'MERIT_BASE',
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
      estimateKind: 'MERIT_BASE',
      meritEstimateSource: 'reserve_tvl',
      anchorTvlUsd: anchor,
    });
    const daily = (anchor * (aprPct / 100)) / 365;
    const hyp = anchor + deposit;
    expect(result?.apr).toBeCloseTo((daily * 365) / hyp, 10);
  });

  it('falls back to current APR when latest-round reward data is missing', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_BASE',
      depositUsd: 100_000,
      forecastAprPercent: 4.084439890516138,
      startDate: 'Thu Feb 26 2026',
      endDate: 'Thu Mar 12 2026',
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      unavailable: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      usesCurrentRateFallback: true,
    });
    expect(result?.apr).toBeCloseTo(0.04084439890516138, 12);
    expect(result?.dailyRewards).toBeCloseTo((100_000 * 0.04084439890516138) / 365, 10);
  });

  it('scales self-auth APR by the eligible cap when latest-round reward data is missing', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4.084439890516138,
      selfCapUsd: 1000,
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      unavailable: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      usesCurrentRateFallback: true,
      selfCapUsd: 1000,
      selfEligibleUsd: 1000,
    });
    expect(result?.apr).toBeCloseTo(0.0004084439890516138, 12);
    expect(result?.dailyRewards).toBeCloseTo((1000 * 0.04084439890516138) / 365, 10);
  });

  it('returns null for zero deposit', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_BASE',
      depositUsd: 0,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for negative deposit', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_BASE',
      depositUsd: -1000,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for zero APR', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_BASE',
      depositUsd: 100_000,
      forecastAprPercent: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null for MERIT_SELF_CAP with zero selfCapUsd', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfCapUsd: 0,
    });
    expect(result).toBeNull();
  });

  it('clamps eligible deposit to selfCapUsd when deposit exceeds cap', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfCapUsd: 1000,
    });
    expect(result).not.toBeNull();
    expect(result?.selfEligibleUsd).toBe(1000);
    expect(result?.selfCapUsd).toBe(1000);
  });

  it('uses anchorTvlUsd for MERIT_SELF_CAP base estimate', () => {
    const result = forecastMeritCampaign({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfCapUsd: 1000,
      baseAprPercent: 3,
      anchorTvlUsd: 5_000_000,
    });
    expect(result).not.toBeNull();
    expect(result?.estimateKind).toBe('MERIT_SELF_CAP');
    expect(result?.meritEstimateSource).toBe('reserve_tvl');
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
