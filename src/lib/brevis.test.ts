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

describe('brevis field normalization', () => {
  it('prefers Merkl-like aligned fields when present', () => {
    const brevis = makeBrevis({
      campaignApr: undefined,
      campaignStartedAt: undefined,
      campaignEndedAt: undefined,
      latestTvl: undefined,
      totalBudget: undefined,
      perUserRewardCapUsd: undefined,
      message: 'Aligned message',
      breakdowns: [
        {
          campaignApr: 2.25,
          campaignStartedAt: '2026-03-02T00:00:00.000Z',
          campaignEndedAt: '2026-04-01T00:00:00.000Z',
          latestTvl: 150_000,
          totalBudget: 9000,
          perUserRewardCapUsd: 5000,
          campaignId: 'linea-usdc',
        },
      ],
    });

    expect(getBrevisCampaignName(brevis)).toBe('Brevis USDC');
    expect(getBrevisCampaignApr(brevis)).toBe(2.25);
    expect(getBrevisCampaignStartedAt(brevis)).toBe('2026-03-02T00:00:00.000Z');
    expect(getBrevisCampaignEndedAt(brevis)).toBe('2026-04-01T00:00:00.000Z');
    expect(getBrevisCampaignMessage(brevis)).toBe('Aligned message');
    expect(getBrevisLatestTvl(brevis)).toBe(150_000);
    expect(getBrevisTotalBudget(brevis)).toBe(9000);
    expect(getBrevisPerUserRewardCapUsd(brevis)).toBe(5000);
    expect(getBrevisCampaignBreakdowns(brevis)).toHaveLength(1);
  });

  it('reads canonical Brevis fields directly', () => {
    const brevis = makeBrevis();

    expect(getBrevisCampaignName(brevis)).toBe('Brevis USDC');
    expect(getBrevisCampaignApr(brevis)).toBe(1.5);
    expect(getBrevisCampaignStartedAt(brevis)).toBe('2026-03-01T00:00:00.000Z');
    expect(getBrevisCampaignEndedAt(brevis)).toBe('2026-03-31T00:00:00.000Z');
    expect(getBrevisCampaignMessage(brevis)).toBe('Brevis campaign');
    expect(getBrevisLatestTvl(brevis)).toBeUndefined();
    expect(getBrevisTotalBudget(brevis)).toBeUndefined();
    expect(getBrevisPerUserRewardCapUsd(brevis)).toBeUndefined();
  });

  it('returns undefined when message is absent', () => {
    const brevis = makeBrevis({
      message: undefined,
    });

    expect(getBrevisCampaignMessage(brevis)).toBeUndefined();
  });

  it('resolves breakdown fields with per-breakdown values overriding group fallbacks', () => {
    const brevis = makeBrevis({
      name: 'Brevis Group',
      message: 'Group message',
      campaignApr: 1.5,
      campaignStartedAt: '2026-03-01T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 120_000,
      totalBudget: 9_000,
      perUserRewardCapUsd: 2_500,
      campaignId: 'group-campaign',
      breakdowns: [
        {
          campaignApr: 2.25,
          campaignStartedAt: '2026-03-02T00:00:00.000Z',
          campaignEndedAt: undefined,
          latestTvl: undefined,
          totalBudget: 10_000,
          perUserRewardCapUsd: undefined,
          campaignId: 'breakdown-campaign',
        },
      ],
    });

    expect(getBrevisResolvedBreakdown(brevis, brevis.breakdowns?.[0])).toEqual({
      name: 'Brevis Group',
      message: 'Group message',
      link: 'https://example.com/brevis',
      campaignApr: 2.25,
      campaignStartedAt: '2026-03-02T00:00:00.000Z',
      campaignEndedAt: '2026-03-31T00:00:00.000Z',
      latestTvl: 120_000,
      totalBudget: 10_000,
      perUserRewardCapUsd: 2_500,
      campaignId: 'breakdown-campaign',
    });
  });
});
