import { describe, expect, it } from 'vitest';

import { forecastBrevisAprPercent, forecastBrevisDetailed } from './brevisForecast';
import type { BrevisIncentive } from '@/types/aave';

const MS_PER_DAY = 86_400_000;

const daysFromNowMs = (days: number): number => Date.now() + days * MS_PER_DAY;

const makeBrevis = (overrides: Partial<BrevisIncentive> = {}): BrevisIncentive => ({
  campaignApr: 10,
  link: 'https://example.com/brevis',
  campaignStartedAt: new Date(daysFromNowMs(-30)).toISOString(),
  campaignEndedAt: new Date(daysFromNowMs(335)).toISOString(),
  message: 'Brevis USDC',
  ...overrides,
});

describe('forecastBrevisAprPercent', () => {
  it('returns nominal APR when no perUserRewardCapUsd is set', () => {
    const brevis = makeBrevis();
    expect(forecastBrevisAprPercent(brevis, 50_000)).toBe(10);
  });

  it('reads per-user cap and dates from breakdowns when top-level fields are absent', () => {
    const nowMs = Date.now();
    const brevis = makeBrevis({
      campaignApr: undefined,
      campaignStartedAt: undefined,
      campaignEndedAt: undefined,
      breakdowns: [
        {
          campaignApr: 10,
          campaignStartedAt: new Date(nowMs - 30 * MS_PER_DAY).toISOString(),
          campaignEndedAt: new Date(nowMs + 335 * MS_PER_DAY).toISOString(),
          perUserRewardCapUsd: 5000,
          campaignId: 'nested',
        },
      ],
    });
    expect(forecastBrevisAprPercent(brevis, 100_000, nowMs)).toBeCloseTo(5, 0);
  });

  it('returns nominal APR when deposit is zero', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 0)).toBe(10);
  });

  it('returns nominal APR when deposit is negative', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, -100)).toBe(10);
  });

  it('returns 0 when nominal APR is 0', () => {
    const brevis = makeBrevis({ campaignApr: 0, perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 50_000)).toBe(0);
  });

  it('returns nominal APR when cap is not binding (small deposit)', () => {
    const nowMs = Date.now();
    const endMs = nowMs + 365 * MS_PER_DAY;
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(endMs).toISOString(),
    });
    expect(forecastBrevisAprPercent(brevis, 1000, nowMs)).toBeCloseTo(10, 0);
  });

  it('reduces APR when cap is binding (large deposit)', () => {
    const nowMs = Date.now();
    const endMs = nowMs + 365 * MS_PER_DAY;
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(endMs).toISOString(),
    });
    const result = forecastBrevisAprPercent(brevis, 100_000, nowMs);
    expect(result).toBeCloseTo(5, 0);
    expect(result).toBeLessThan(10);
  });

  it('handles exactly-half-year remaining correctly', () => {
    const nowMs = Date.now();
    const endMs = nowMs + (365 / 2) * MS_PER_DAY;
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(endMs).toISOString(),
    });
    const result = forecastBrevisAprPercent(brevis, 200_000, nowMs);
    expect(result).toBeCloseTo(5, 0);
  });

  it('returns nominal APR when endDate is in the past', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(daysFromNowMs(-1)).toISOString(),
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBe(10);
  });

  it('returns nominal APR when endDate is empty string (no endDate)', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBe(10);
  });

  it('returns nominal APR when endDate is unparseable', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: 'not-a-date',
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBe(10);
  });

  it('handles date-only endDate format', () => {
    const nowMs = Date.now();
    const futureDate = new Date(nowMs + 365 * MS_PER_DAY);
    const dateOnly = futureDate.toISOString().slice(0, 10);
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: dateOnly,
    });
    const result = forecastBrevisAprPercent(brevis, 100_000, nowMs);
    expect(result).toBeLessThan(10);
    expect(result).toBeGreaterThan(0);
  });

  it('returns nominal APR when perUserRewardCapUsd is negative', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: -100 });
    expect(forecastBrevisAprPercent(brevis, 50_000)).toBe(10);
  });

  it('cap becomes less binding as remaining time shrinks', () => {
    const nowMs = Date.now();
    const brevisLong = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(nowMs + 365 * MS_PER_DAY).toISOString(),
    });
    const brevisShort = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(nowMs + 30 * MS_PER_DAY).toISOString(),
    });
    const deposit = 100_000;
    const aprLong = forecastBrevisAprPercent(brevisLong, deposit, nowMs);
    const aprShort = forecastBrevisAprPercent(brevisShort, deposit, nowMs);
    expect(aprShort).toBeGreaterThanOrEqual(aprLong);
  });

  it('returns nominal APR when no endDate and cap set (graceful degradation)', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBe(10);
  });
});

describe('forecastBrevisDetailed', () => {
  it('returns non-binding result with remainingDays when no cap is set', () => {
    const brevis = makeBrevis();
    const result = forecastBrevisDetailed(brevis, 50_000);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.rewardHeadroomUsd).toBeNull();
    expect(result.daysToHitCap).toBeNull();
    expect(result.remainingDays).toBeGreaterThan(0);
  });

  it('computes daysToHitCap even without valid endDate', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    const result = forecastBrevisDetailed(brevis, 50_000);
    expect(result.daysToHitCap).toBeCloseTo(365, 0);
    expect(result.rewardHeadroomUsd).toBe(5000);
    expect(result.isCapBinding).toBe(false);
    expect(result.remainingDays).toBeNull();
  });

  it('reports cap binding when large deposit exceeds cap over campaign', () => {
    const nowMs = Date.now();
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(nowMs + 365 * MS_PER_DAY).toISOString(),
    });
    const result = forecastBrevisDetailed(brevis, 100_000, nowMs);
    expect(result.isCapBinding).toBe(true);
    expect(result.aprPercent).toBeCloseTo(5, 0);
    expect(result.rewardHeadroomUsd).toBe(5000);
    expect(result.daysToHitCap).toBeCloseTo(182.5, 0);
    expect(result.remainingDays).toBeCloseTo(365, 0);
  });

  it('reports cap not binding for small deposit', () => {
    const nowMs = Date.now();
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(nowMs + 365 * MS_PER_DAY).toISOString(),
    });
    const result = forecastBrevisDetailed(brevis, 1000, nowMs);
    expect(result.isCapBinding).toBe(false);
    expect(result.aprPercent).toBeCloseTo(10, 0);
    expect(result.rewardHeadroomUsd).toBe(5000);
    expect(result.remainingDays).toBeCloseTo(365, 0);
  });

  it('returns null diagnostics when APR is 0', () => {
    const brevis = makeBrevis({ campaignApr: 0, perUserRewardCapUsd: 5000 });
    const result = forecastBrevisDetailed(brevis, 50_000);
    expect(result.aprPercent).toBe(0);
    expect(result.isCapBinding).toBe(false);
    expect(result.daysToHitCap).toBeNull();
    expect(result.remainingDays).toBeGreaterThan(0);
  });

  it('returns null diagnostics when deposit is 0', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    const result = forecastBrevisDetailed(brevis, 0);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.daysToHitCap).toBeNull();
    expect(result.rewardHeadroomUsd).toBe(5000);
    expect(result.remainingDays).toBeGreaterThan(0);
  });

  it('returns null remainingDays when endDate is absent', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    const result = forecastBrevisDetailed(brevis, 100_000);
    expect(result.remainingDays).toBeNull();
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.daysToHitCap).toBeCloseTo(182.5, 0);
  });
});
