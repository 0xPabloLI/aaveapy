import { describe, expect, it } from 'vitest';

import { extractMeritSelfPositionCapUsd, forecastMeritApr, getMeritCampaignCycleDays } from './meritForecast';

describe('extractMeritSelfPositionCapUsd', () => {
  it('parses the Self-auth cap from structured Merit messages', () => {
    const cap = extractMeritSelfPositionCapUsd([
      {
        action: 'Self Authentication',
        description:
          'Supply USDT and double your yield by verifying your humanity through Self for the first $1000 USDT supplied per user.',
      },
    ]);

    expect(cap).toBe(1000);
  });

  it('returns null when message has no Self reference', () => {
    const cap = extractMeritSelfPositionCapUsd([
      { action: 'Base Reward', description: 'Standard merit reward.' },
    ]);
    expect(cap).toBeNull();
  });

  it('returns null for undefined message', () => {
    expect(extractMeritSelfPositionCapUsd(undefined)).toBeNull();
  });

  it('parses cap with comma-separated thousands when self and amount are on same line', () => {
    const cap = extractMeritSelfPositionCapUsd([
      'Self Authentication: Supply and double your yield for the first $10,000 USDT supplied per user.',
    ]);
    expect(cap).toBe(10000);
  });
});

describe('forecastMeritApr', () => {
  it('uses anchor reserve TVL × APR when anchorTvlUsd is set (before last round)', () => {
    const anchor = 9_000_000;
    const aprPct = 4;
    const deposit = 100_000;
    const result = forecastMeritApr({
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
    const result = forecastMeritApr({
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
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4.084439890516138,
      selfPositionCapUsd: 1000,
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      unavailable: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      usesCurrentRateFallback: true,
      selfPositionCapUsd: 1000,
      eligibleUsd: 1000,
    });
    expect(result?.apr).toBeCloseTo(0.04084439890516138, 12);
    expect(result?.dailyRewards).toBeCloseTo((1000 * 0.04084439890516138) / 365, 10);
  });

  it('returns null for zero deposit', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_BASE',
      depositUsd: 0,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for negative deposit', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_BASE',
      depositUsd: -1000,
      forecastAprPercent: 4,
    });
    expect(result).toBeNull();
  });

  it('returns null for zero APR', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_BASE',
      depositUsd: 100_000,
      forecastAprPercent: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null for MERIT_SELF_CAP with zero selfPositionCapUsd', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfPositionCapUsd: 0,
    });
    expect(result).toBeNull();
  });

  it('clamps eligible deposit to selfPositionCapUsd when deposit exceeds cap', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfPositionCapUsd: 1000,
    });
    expect(result).not.toBeNull();
    expect(result?.eligibleUsd).toBe(1000);
    expect(result?.selfPositionCapUsd).toBe(1000);
  });

  it('uses anchorTvlUsd for MERIT_SELF_CAP base estimate', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 100_000,
      forecastAprPercent: 4,
      selfPositionCapUsd: 1000,
      baseAprPercent: 3,
      anchorTvlUsd: 5_000_000,
    });
    expect(result).not.toBeNull();
    expect(result?.estimateKind).toBe('MERIT_SELF_CAP');
    expect(result?.meritEstimateSource).toBe('reserve_tvl');
  });

  it('BUG REPRO: same delta + same cap but different existing position produces same unscaled APR (cap applied by caller)', () => {
    const aprPct = 4;
    const selfCap = 1000;

    const withNoPosition = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 1000,
      forecastAprPercent: aprPct,
      selfPositionCapUsd: selfCap,
    });

    const withExistingPosition = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 1000,
      forecastAprPercent: aprPct,
      selfPositionCapUsd: selfCap,
      totalPositionUsd: 2000,
    });

    const withLargerPosition = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 2000,
      forecastAprPercent: aprPct,
      selfPositionCapUsd: selfCap,
      totalPositionUsd: 3000,
    });

    expect(withNoPosition).not.toBeNull();
    expect(withExistingPosition).not.toBeNull();
    expect(withLargerPosition).not.toBeNull();

    expect(withNoPosition!.apr).toBeCloseTo(aprPct / 100, 10);
    expect(withExistingPosition!.apr).toBeCloseTo(aprPct / 100, 10);
    expect(withLargerPosition!.apr).toBeCloseTo(aprPct / 100, 10);

    expect(withNoPosition!.eligibleUsd).toBe(1000);
    expect(withExistingPosition!.eligibleUsd).toBe(1000);
    expect(withLargerPosition!.eligibleUsd).toBe(1000);
  });

  it('with totalPositionUsd, eligible deposit uses total position for cap check (cap applied by caller)', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 1000,
      forecastAprPercent: 4,
      selfPositionCapUsd: 1000,
      totalPositionUsd: 2000,
    });
    expect(result).not.toBeNull();
    expect(result!.eligibleUsd).toBe(1000);
    expect(result!.apr).toBeCloseTo(4 / 100, 10);
  });

  it('totalPositionUsd within cap returns unscaled APR (cap not binding)', () => {
    const result = forecastMeritApr({
      mode: 'MERIT_SELF_CAP',
      depositUsd: 500,
      forecastAprPercent: 4,
      selfPositionCapUsd: 1000,
      totalPositionUsd: 800,
    });
    expect(result).not.toBeNull();
    expect(result!.eligibleUsd).toBe(800);
    expect(result!.apr).toBeCloseTo(4 / 100, 10);
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
