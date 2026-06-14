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

  it('cap is binding when perUserRewardCapUsd is set and deposit is large', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBeCloseTo(0.5, 1);
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
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 1000)).toBeCloseTo(10, 0);
  });

  it('reduces APR proportionally when cap is binding (large deposit)', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBeCloseTo(0.5, 1);
  });

  it('position cap does not depend on endDate', () => {
    const brevisNoEnd = makeBrevis({ perUserRewardCapUsd: 5000, campaignEndedAt: '' });
    const brevisWithEnd = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevisNoEnd, 100_000)).toBeCloseTo(0.5, 1);
    expect(forecastBrevisAprPercent(brevisNoEnd, 100_000)).toBeCloseTo(
      forecastBrevisAprPercent(brevisWithEnd, 100_000), 10,
    );
  });

  it('returns nominal APR when endDate is in the past (position cap is static)', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(daysFromNowMs(-1)).toISOString(),
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBeCloseTo(0.5, 1);
  });

  it('returns nominal APR when endDate is empty string', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    expect(forecastBrevisAprPercent(brevis, 100_000)).toBeCloseTo(0.5, 1);
  });

  it('returns nominal APR when perUserRewardCapUsd is negative', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: -100 });
    expect(forecastBrevisAprPercent(brevis, 50_000)).toBe(10);
  });

  it('position cap APR is independent of campaign duration', () => {
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
    expect(forecastBrevisAprPercent(brevisLong, deposit, nowMs)).toBeCloseTo(
      forecastBrevisAprPercent(brevisShort, deposit, nowMs), 10,
    );
  });

  it('exactly at cap boundary returns nominal APR', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 5000)).toBeCloseTo(10, 10);
  });

  it('combined deposit reduces APR for shared campaign', () => {
    const brevis = makeBrevis({ perUserRewardCapUsd: 5000 });
    expect(forecastBrevisAprPercent(brevis, 50_000, Date.now(), 100_000)).toBeCloseTo(0.5, 1);
  });
});

describe('forecastBrevisDetailed', () => {
  it('returns non-binding result with remainingDays when no cap is set', () => {
    const brevis = makeBrevis();
    const result = forecastBrevisDetailed(brevis, 50_000);
    expect(result.aprPercent).toBe(10);
    expect(result.isCapBinding).toBe(false);
    expect(result.eligibleUsd).toBeNull();
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
    expect(result.eligibleUsd).toBe(5000);
    expect(result.isCapBinding).toBe(true);
    expect(result.remainingDays).toBeNull();
  });

  it('reports cap binding when deposit exceeds cap (position cap)', () => {
    const nowMs = Date.now();
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(nowMs + 365 * MS_PER_DAY).toISOString(),
    });
    const result = forecastBrevisDetailed(brevis, 100_000, nowMs);
    expect(result.isCapBinding).toBe(true);
    expect(result.aprPercent).toBeCloseTo(0.5, 1);
    expect(result.eligibleUsd).toBe(5000);
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
    expect(result.eligibleUsd).toBe(1000);
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
    expect(result.eligibleUsd).toBe(5000);
    expect(result.remainingDays).toBeGreaterThan(0);
  });

  it('returns null remainingDays when endDate is absent', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: '',
    });
    const result = forecastBrevisDetailed(brevis, 100_000);
    expect(result.remainingDays).toBeNull();
    expect(result.aprPercent).toBeCloseTo(0.5, 1);
    expect(result.isCapBinding).toBe(true);
    expect(result.daysToHitCap).toBeCloseTo(182.5, 0);
  });

  it('position cap binds even when endDate is past', () => {
    const brevis = makeBrevis({
      perUserRewardCapUsd: 5000,
      campaignEndedAt: new Date(daysFromNowMs(-1)).toISOString(),
    });
    const result = forecastBrevisDetailed(brevis, 100_000);
    expect(result.isCapBinding).toBe(true);
    expect(result.aprPercent).toBeCloseTo(0.5, 1);
    expect(result.eligibleUsd).toBe(5000);
  });
});
