import { describe, expect, it } from 'vitest';

import type { BrevisIncentive } from '@/types/aave';
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
