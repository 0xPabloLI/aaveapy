import { describe, it, expect } from 'vitest';
import {
  aggregateMeritIncentiveApr,
  aggregateMerklOpportunityApr,
  aggregateBrevisIncentiveApr,
} from './incentiveAggregation';
import type { MeritCampaignGroup, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('aggregateMeritIncentiveApr', () => {
  it('sums campaignApr for active breakdowns', () => {
    const groups: MeritCampaignGroup[] = [
      {
        link: 'https://example.com',
        breakdowns: [
          { campaignApr: 3, campaignId: 'base', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
          { campaignApr: 2, campaignId: 'self', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
        ],
      },
    ];
    expect(aggregateMeritIncentiveApr(groups)).toBe(5);
  });

  it('excludes inactive campaigns', () => {
    const groups: MeritCampaignGroup[] = [
      {
        link: 'https://example.com',
        breakdowns: [
          { campaignApr: 3, campaignId: 'base', campaignStartedAt: daysFromNowIso(-10), campaignEndedAt: daysFromNowIso(-5) },
        ],
      },
    ];
    expect(aggregateMeritIncentiveApr(groups)).toBe(0);
  });

  it('returns 0 for undefined/empty', () => {
    expect(aggregateMeritIncentiveApr()).toBe(0);
    expect(aggregateMeritIncentiveApr([])).toBe(0);
  });

  it('sanitizes NaN/negative values', () => {
    const groups: MeritCampaignGroup[] = [
      {
        link: 'https://example.com',
        breakdowns: [
          { campaignApr: NaN, campaignId: 'a', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
          { campaignApr: -1, campaignId: 'b', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
        ],
      },
    ];
    expect(aggregateMeritIncentiveApr(groups)).toBe(0);
  });

  it('converts to APY when isApy is true', () => {
    const groups: MeritCampaignGroup[] = [
      {
        link: 'https://example.com',
        breakdowns: [
          { campaignApr: 10, campaignId: 'a', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
        ],
      },
    ];
    const apr = aggregateMeritIncentiveApr(groups);
    const apy = aggregateMeritIncentiveApr(groups, { isApy: true });
    expect(apy).toBeGreaterThan(apr);
  });
});

describe('aggregateMerklOpportunityApr', () => {
  it('sums active campaign APRs', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          { campaignApr: 4, campaignId: 'a', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
          { campaignApr: 5, campaignId: 'b', campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
        ],
      },
    ];
    expect(aggregateMerklOpportunityApr(opportunities)).toBe(9);
  });

  it('excludes inactive campaigns', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          { campaignApr: 4, campaignId: 'a', campaignStartedAt: daysFromNowIso(-10), campaignEndedAt: daysFromNowIso(-5) },
        ],
      },
    ];
    expect(aggregateMerklOpportunityApr(opportunities)).toBe(0);
  });

  it('returns 0 for undefined/empty', () => {
    expect(aggregateMerklOpportunityApr()).toBe(0);
    expect(aggregateMerklOpportunityApr([])).toBe(0);
  });

  it('respects whitelistMerklCampaignIds', () => {
    const opportunities: MerklOpportunityGroup[] = [
      {
        breakdowns: [
          { campaignApr: 4, campaignId: 'wl-1', whitelistOnly: true, campaignStartedAt: daysFromNowIso(-1), campaignEndedAt: daysFromNowIso(1) },
        ],
      },
    ];
    expect(aggregateMerklOpportunityApr(opportunities)).toBe(0);
    expect(aggregateMerklOpportunityApr(opportunities, { whitelistMerklCampaignIds: new Set(['wl-1']) })).toBe(4);
  });
});

describe('aggregateBrevisIncentiveApr', () => {
  it('sums active campaign APRs from breakdowns', () => {
    const brevis: BrevisIncentive[] = [
      {
        campaignApr: 3,
        link: 'https://example.com',
        campaignStartedAt: daysFromNowIso(-1),
        campaignEndedAt: daysFromNowIso(1),
        message: 'Active',
      },
    ];
    expect(aggregateBrevisIncentiveApr(brevis)).toBe(3);
  });

  it('excludes inactive campaigns', () => {
    const brevis: BrevisIncentive[] = [
      {
        campaignApr: 3,
        link: 'https://example.com',
        campaignStartedAt: daysFromNowIso(-10),
        campaignEndedAt: daysFromNowIso(-5),
        message: 'Past',
      },
    ];
    expect(aggregateBrevisIncentiveApr(brevis)).toBe(0);
  });

  it('returns 0 for undefined/empty', () => {
    expect(aggregateBrevisIncentiveApr()).toBe(0);
    expect(aggregateBrevisIncentiveApr([])).toBe(0);
  });

  it('converts to APY when isApy is true', () => {
    const brevis: BrevisIncentive[] = [
      {
        campaignApr: 10,
        link: 'https://example.com',
        campaignStartedAt: daysFromNowIso(-1),
        campaignEndedAt: daysFromNowIso(1),
        message: 'Active',
      },
    ];
    const apr = aggregateBrevisIncentiveApr(brevis);
    const apy = aggregateBrevisIncentiveApr(brevis, { isApy: true });
    expect(apy).toBeGreaterThan(apr);
  });
});
