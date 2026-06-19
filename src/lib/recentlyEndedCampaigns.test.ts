import { describe, it, expect } from 'vitest';
import { isRecentlyEnded, collectRecentlyEndedCampaigns, DEFAULT_LOOKBACK_DAYS } from './recentlyEndedCampaigns';
import type { MeritCampaignGroup, MerklOpportunityGroup, ReserveWithSpread } from '@/types/aave';
import type { MerklCampaignBreakdown, BrevisIncentive } from '../shared/market-contract/schemas';

const NOW_MS = new Date('2026-05-15T12:00:00Z').getTime();

function mockReserve(overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread {
  return {
    marketName: 'Test Market',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    tokenAddress: '0x0',
    reserveId: 'test-reserve',
    ...overrides,
  } as ReserveWithSpread;
}

function msFromNow(daysOffset: number, timeStr = 'T12:00:00.000Z'): string {
  const d = new Date(NOW_MS + daysOffset * 24 * 60 * 60 * 1000);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}${timeStr}`;
}

describe('isRecentlyEnded', () => {
  it('returns true for campaign that ended exactly 7 days ago (boundary)', () => {
    const endDate = msFromNow(-7);
    expect(isRecentlyEnded(endDate, NOW_MS)).toBe(true);
  });

  it('returns false for campaign that ended 8 days ago', () => {
    const endDate = msFromNow(-8);
    expect(isRecentlyEnded(endDate, NOW_MS)).toBe(false);
  });

  it('returns false when endDate is undefined', () => {
    expect(isRecentlyEnded(undefined, NOW_MS)).toBe(false);
  });

  it('returns false for future date (still active)', () => {
    const endDate = msFromNow(30);
    expect(isRecentlyEnded(endDate, NOW_MS)).toBe(false);
  });

  it('returns false for date exactly at now (not yet ended)', () => {
    const endDate = '2026-05-15T12:00:00.000Z';
    expect(isRecentlyEnded(endDate, NOW_MS)).toBe(false);
  });

  it('respects custom lookbackDays', () => {
    const threeDaysAgo = msFromNow(-3);
    expect(isRecentlyEnded(threeDaysAgo, NOW_MS, 3)).toBe(true);
    const fourDaysAgo = msFromNow(-4);
    expect(isRecentlyEnded(fourDaysAgo, NOW_MS, 3)).toBe(false);
  });

  it('handles date-only format (end-day normalization)', () => {
    expect(isRecentlyEnded('2026-05-09', NOW_MS)).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isRecentlyEnded('not-a-date', NOW_MS)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isRecentlyEnded('', NOW_MS)).toBe(false);
  });
});

describe('DEFAULT_LOOKBACK_DAYS', () => {
  it('is 7', () => {
    expect(DEFAULT_LOOKBACK_DAYS).toBe(7);
  });
});

describe('collectRecentlyEndedCampaigns', () => {
  it('collects only Merit campaigns that ended within the window', () => {
    const activeMerit: MeritCampaignGroup = {
      link: 'https://merit.example/active',
      name: 'Active Merit',
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2026-01-01',
        campaignEndedAt: '2026-12-31',
        campaignId: 'merit-active',
      }],
    };
    const recentlyEndedMerit: MeritCampaignGroup = {
      link: 'https://merit.example/ended',
      name: 'Recently Ended Merit',
      breakdowns: [{
        campaignApr: 3,
        campaignStartedAt: '2026-01-01',
        campaignEndedAt: '2026-05-12',
        campaignId: 'merit-ended',
      }],
    };
    const oldEndedMerit: MeritCampaignGroup = {
      link: 'https://merit.example/old',
      name: 'Old Ended Merit',
      breakdowns: [{
        campaignApr: 2,
        campaignStartedAt: '2025-01-01',
        campaignEndedAt: '2026-04-01',
        campaignId: 'merit-old',
      }],
    };

    const reserve = mockReserve({
      meritSupplys: [activeMerit, recentlyEndedMerit, oldEndedMerit],
    });

    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('merit');
    expect(result[0].name).toBe('Recently Ended Merit');
    expect(result[0].campaigns).toHaveLength(1);
    expect(result[0].campaigns[0].apr).toBe(3);
    expect(result[0].campaigns[0].endDate).toBe('2026-05-12');
  });

  it('returns empty array when reserve has no campaigns', () => {
    const reserve = mockReserve();
    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);
    expect(result).toEqual([]);
  });

  it('returns empty array when all campaigns are active', () => {
    const activeMerit: MeritCampaignGroup = {
      link: 'https://merit.example',
      name: 'Active',
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2026-01-01',
        campaignEndedAt: '2026-12-31',
        campaignId: 'merit-active',
      }],
    };
    const reserve = mockReserve({ meritSupplys: [activeMerit] });
    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);
    expect(result).toEqual([]);
  });

  it('collects from all three source types (Merit, Merkl, Brevis)', () => {
    const endedMerit: MeritCampaignGroup = {
      link: 'https://merit.example',
      name: 'Ended Merit',
      breakdowns: [{
        campaignApr: 3,
        campaignStartedAt: '2026-01-01',
        campaignEndedAt: '2026-05-10',
        campaignId: 'merit-ended',
      }],
    };

    const endedMerklBreakdown: MerklCampaignBreakdown = {
      campaignApr: 1.5,
      campaignStartedAt: '2026-01-01',
      campaignEndedAt: '2026-05-12',
      campaignId: 'merkl-1',
    } as MerklCampaignBreakdown;
    const endedMerklGroup: MerklOpportunityGroup = {
      link: 'https://merkl.example',
      name: 'Ended Merkl',
      breakdowns: [endedMerklBreakdown],
    } as MerklOpportunityGroup;

    const endedBrevis: BrevisIncentive = {
      link: 'https://brevis.example',
      name: 'Ended Brevis',
      campaignApr: 2,
      campaignStartedAt: '2026-01-01',
      campaignEndedAt: '2026-05-13',
    } as BrevisIncentive;

    const reserve = mockReserve({
      meritSupplys: [endedMerit],
      merklSupplys: [endedMerklGroup],
      brevisSupplys: [endedBrevis],
    });

    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);

    expect(result).toHaveLength(3);
    const types = result.map((s) => s.sourceType).sort();
    expect(types).toEqual(['brevis', 'merit', 'merkl']);
  });

  it('uses borrow-side campaigns when supplyOrBorrow is borrow', () => {
    const endedMeritBorrow: MeritCampaignGroup = {
      link: 'https://merit.example/borrow',
      name: 'Borrow Merit',
      breakdowns: [{
        campaignApr: 4,
        campaignStartedAt: '2026-01-01',
        campaignEndedAt: '2026-05-12',
        campaignId: 'merit-borrow',
      }],
    };

    const reserve = mockReserve({
      meritSupplys: [],
      meritBorrows: [endedMeritBorrow],
    });

    const result = collectRecentlyEndedCampaigns(reserve, 'borrow', NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Borrow Merit');
  });

  it('handles Merit groups with multiple breakdowns as separate campaign entries', () => {
    const meritWithMultiple: MeritCampaignGroup = {
      link: 'https://merit.example',
      name: 'ACI Incentive',
      breakdowns: [
        {
          campaignApr: 3,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2026-05-12',
          campaignId: 'merit-base',
        },
        {
          campaignApr: 2,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2026-05-12',
          campaignId: 'merit-self',
          positionCap: 1000,
        },
      ],
    };

    const reserve = mockReserve({ meritSupplys: [meritWithMultiple] });
    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].campaigns).toHaveLength(2);
    expect(result[0].campaigns[0].apr).toBe(3);
    expect(result[0].campaigns[1].apr).toBe(2);
  });
});
