import { describe, expect, it } from 'vitest';

import type { BrevisIncentive, MerklForecastWireItem } from '@/types/aave';
import { forecastBreakdownApr } from '@/lib/merklForecast';
import {
  getBrevisCampaignApr,
  getBrevisCampaignBreakdowns,
  getBrevisCampaignEndedAt,
  getBrevisCampaignName,
  getBrevisCampaignMessage,
  getBrevisCampaignStartedAt,
  getBrevisLatestTvl,
  getBrevisPerUserRewardCapUsd,
  getBrevisResolvedBreakdown,
  getBrevisTotalBudget,
  hasActiveBrevisBreakdown,
  toMerklBreakdown,
} from './brevis';

const makeBrevis = (overrides: Partial<BrevisIncentive> = {}): BrevisIncentive => ({
  link: 'https://example.com/brevis',
  name: 'Brevis USDC',
  campaignApr: 1.5,
  campaignStartedAt: '2026-03-01T00:00:00.000Z',
  campaignEndedAt: '2026-03-31T00:00:00.000Z',
  message: 'Brevis campaign',
  ...overrides,
});

describe('brevis field accessors', () => {
  it('reads top-level fields directly', () => {
    const brevis = makeBrevis();

    expect(getBrevisCampaignName(brevis)).toBe('Brevis USDC');
    expect(getBrevisCampaignApr(brevis)).toBe(1.5);
    expect(getBrevisCampaignStartedAt(brevis)).toBe('2026-03-01T00:00:00.000Z');
    expect(getBrevisCampaignEndedAt(brevis)).toBe('2026-03-31T00:00:00.000Z');
    expect(getBrevisCampaignMessage(brevis)).toBe('Brevis campaign');
  });

  it('fallback to 0 when campaignApr is undefined', () => {
    const brevis = makeBrevis({ campaignApr: undefined });
    expect(getBrevisCampaignApr(brevis)).toBe(0);
  });

  it('returns undefined for optional fields when absent', () => {
    const brevis = makeBrevis();
    expect(getBrevisLatestTvl(brevis)).toBeUndefined();
    expect(getBrevisTotalBudget(brevis)).toBeUndefined();
    expect(getBrevisPerUserRewardCapUsd(brevis)).toBeUndefined();
  });

  it('returns undefined when message is absent', () => {
    const brevis = makeBrevis({ message: undefined });
    expect(getBrevisCampaignMessage(brevis)).toBeUndefined();
  });

  it('reads optional fields when present', () => {
    const brevis = makeBrevis({
      latestTvl: 150_000,
      totalBudget: 9000,
      perUserRewardCapUsd: 5000,
    });
    expect(getBrevisLatestTvl(brevis)).toBe(150_000);
    expect(getBrevisTotalBudget(brevis)).toBe(9000);
    expect(getBrevisPerUserRewardCapUsd(brevis)).toBe(5000);
  });
});

describe('getBrevisCampaignBreakdowns', () => {
  it('returns single-element array from top-level fields', () => {
    const brevis = makeBrevis();
    const breakdowns = getBrevisCampaignBreakdowns(brevis);
    expect(breakdowns).toHaveLength(1);
    expect(breakdowns[0].campaignApr).toBe(1.5);
  });
});

describe('getBrevisResolvedBreakdown', () => {
  it('resolves from top-level fields when no breakdown provided', () => {
    const brevis = makeBrevis();
    const resolved = getBrevisResolvedBreakdown(brevis);
    expect(resolved.campaignApr).toBe(1.5);
    expect(resolved.name).toBe('Brevis USDC');
    expect(resolved.link).toBe('https://example.com/brevis');
  });

  it('prefers breakdown values over top-level when provided', () => {
    const brevis = makeBrevis({
      campaignApr: 1.5,
      breakdowns: [{ campaignApr: 2.25, campaignStartedAt: '2026-04-01T00:00:00.000Z', campaignEndedAt: '2026-05-01T00:00:00.000Z' }],
    });
    const resolved = getBrevisResolvedBreakdown(brevis, brevis.breakdowns?.[0]);
    expect(resolved.campaignApr).toBe(2.25);
  });
});

describe('hasActiveBrevisBreakdown', () => {
  it('returns true for active campaign dates', () => {
    const nowMs = new Date('2026-03-15').getTime();
    const brevis = makeBrevis({
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    });
    expect(hasActiveBrevisBreakdown(brevis, nowMs)).toBe(true);
  });

  it('returns false for expired campaign', () => {
    const nowMs = new Date('2026-05-01').getTime();
    const brevis = makeBrevis({
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    });
    expect(hasActiveBrevisBreakdown(brevis, nowMs)).toBe(false);
  });
});

describe('toMerklBreakdown', () => {
  it('converts BrevisResolvedBreakdown to MerklCampaignBreakdown with required fields', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 100_000,
      totalBudget: 500,
    }));
    const merkl = toMerklBreakdown(resolved);
    expect(merkl.campaignId).toBe('brevis-1');
    expect(merkl.campaignType).toBe('FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE');
    expect(merkl.campaignApr).toBe(1.5);
    expect(merkl.aprCap).toBe(5);
    expect(merkl.campaignStartedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(merkl.campaignEndedAt).toBe('2026-03-31T00:00:00.000Z');
    expect(merkl.latestTvl).toBe(100_000);
    expect(merkl.totalBudget).toBe(500);
  });

  it('falls back aprCap to campaignApr for FIX type when aprCap is null', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-fix',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: null,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    }));
    const merkl = toMerklBreakdown(resolved);
    expect(merkl.aprCap).toBe(3.2);
  });

  it('falls back aprCap to campaignApr for FIX type when aprCap is undefined', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-fix',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: undefined,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    }));
    const merkl = toMerklBreakdown(resolved);
    expect(merkl.aprCap).toBe(3.2);
  });

  it('preserves null aprCap for non-FIX type', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-max',
      campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: null,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    }));
    const merkl = toMerklBreakdown(resolved);
    expect(merkl.aprCap).toBeNull();
  });

  it('uses empty string for missing campaignStartedAt/EndedAt', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: undefined,
      campaignEndedAt: undefined,
    }));
    const merkl = toMerklBreakdown(resolved);
    expect(merkl.campaignStartedAt).toBe('');
    expect(merkl.campaignEndedAt).toBe('');
    expect(resolved.campaignStartedAt).toBe('');
    expect(resolved.campaignEndedAt).toBe('');
  });
});

describe('Brevis via forecastBreakdownApr', () => {
  const makeForecastStates = (campaignId: string, overrides: Partial<MerklForecastWireItem> = {}): Record<string, MerklForecastWireItem> => ({
    [campaignId]: {
      distributedSoFar: 100,
      endTimestamp: Math.floor(Date.now() / 1000) + 30 * 86400,
      requiredDaily: 5,
      ...overrides,
    },
  });

  it('returns campaignApr when inputUsd=0 and campaignApr>0 (current path)', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 100_000,
      totalBudget: 500,
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 0, makeForecastStates('brevis-1'), 0);
    expect(apr).toBe(3.2);
  });

  it('returns forecast APR when inputUsd>0 (after path)', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 100_000,
      totalBudget: 500,
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 50_000, makeForecastStates('brevis-1'), 0);
    expect(apr).toBeGreaterThan(0);
    expect(apr).toBe(5);
  });

  it('uses aprCap fallback when FIX type has no aprCap', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-fix',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: null,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 100_000,
      totalBudget: 500,
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 50_000, makeForecastStates('brevis-fix'), 0);
    expect(apr).toBeGreaterThan(0);
  });

  it('returns campaignApr when no forecast states available', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 0, {}, 0);
    expect(apr).toBe(3.2);
  });

  it('returns 0 when campaignApr is 0 and no forecast states', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignApr: 0,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 0, {}, 0);
    expect(apr).toBe(0);
  });

  it('passes tydroPointToUsdRate=0 to forecastBreakdownApr (Brevis is not points)', () => {
    const resolved = getBrevisResolvedBreakdown(makeBrevis({
      campaignId: 'brevis-1',
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      aprCap: 5,
      campaignApr: 3.2,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 100_000,
      totalBudget: 500,
    }));
    const merkl = toMerklBreakdown(resolved);
    const apr = forecastBreakdownApr(merkl, 50_000, makeForecastStates('brevis-1'), 0);
    expect(apr).toBeGreaterThan(0);
    expect(Number.isFinite(apr)).toBe(true);
  });
});
