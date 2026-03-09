import { describe, expect, it } from 'vitest';

import { extractMeritSelfCapUsd, forecastMeritCampaign } from './meritForecast';

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
});

describe('forecastMeritCampaign', () => {
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
});
