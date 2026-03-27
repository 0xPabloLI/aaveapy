import { describe, expect, it } from 'vitest';

import type { BrevisIncentive } from '@/types/aave';
import {
  getBrevisCampaignApr,
  getBrevisCampaignEndedAt,
  getBrevisCampaignMessage,
  getBrevisCampaignStartedAt,
  getBrevisLatestTvl,
  getBrevisTotalBudget,
} from './brevis';

const makeBrevis = (overrides: Partial<BrevisIncentive> = {}): BrevisIncentive => ({
  link: 'https://example.com/brevis',
  campaignApr: 1.5,
  campaignStartedAt: '2026-03-01T00:00:00.000Z',
  campaignEndedAt: '2026-03-31T00:00:00.000Z',
  message: 'Brevis campaign',
  ...overrides,
});

describe('brevis field normalization', () => {
  it('prefers Merkl-like aligned fields when present', () => {
    const brevis = makeBrevis({
      campaignApr: 2.25,
      campaignStartedAt: '2026-03-02T00:00:00.000Z',
      campaignEndedAt: '2026-04-01T00:00:00.000Z',
      message: 'Aligned message',
      latestTvl: 150_000,
      totalBudget: 9000,
    });

    expect(getBrevisCampaignApr(brevis)).toBe(2.25);
    expect(getBrevisCampaignStartedAt(brevis)).toBe('2026-03-02T00:00:00.000Z');
    expect(getBrevisCampaignEndedAt(brevis)).toBe('2026-04-01T00:00:00.000Z');
    expect(getBrevisCampaignMessage(brevis)).toBe('Aligned message');
    expect(getBrevisLatestTvl(brevis)).toBe(150_000);
    expect(getBrevisTotalBudget(brevis)).toBe(9000);
  });

  it('reads canonical Brevis fields directly', () => {
    const brevis = makeBrevis();

    expect(getBrevisCampaignApr(brevis)).toBe(1.5);
    expect(getBrevisCampaignStartedAt(brevis)).toBe('2026-03-01T00:00:00.000Z');
    expect(getBrevisCampaignEndedAt(brevis)).toBe('2026-03-31T00:00:00.000Z');
    expect(getBrevisCampaignMessage(brevis)).toBe('Brevis campaign');
    expect(getBrevisLatestTvl(brevis)).toBeUndefined();
    expect(getBrevisTotalBudget(brevis)).toBeUndefined();
  });

  it('returns undefined when message is absent', () => {
    const brevis = makeBrevis({
      message: undefined,
    });

    expect(getBrevisCampaignMessage(brevis)).toBeUndefined();
  });
});
