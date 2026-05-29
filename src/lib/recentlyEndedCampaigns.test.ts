import { describe, it, expect } from 'vitest';
import { isRecentlyEnded, collectRecentlyEndedCampaigns, DEFAULT_LOOKBACK_DAYS } from './recentlyEndedCampaigns';
import type { MeritIncentive, MerklOpportunityGroup, ReserveWithSpread } from '@/types/aave';
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
    // '2026-05-08' normalizes to 2026-05-08T23:59:59.999Z (end of day)
    // which is within the 7-day window from May 15 noon
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
    const activeMerit: MeritIncentive = {
      apr: 5,
      link: 'https://merit.example/active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      name: 'Active Merit',
    };
    const recentlyEndedMerit: MeritIncentive = {
      apr: 3,
      link: 'https://merit.example/ended',
      startDate: '2026-01-01',
      endDate: '2026-05-12',
      name: 'Recently Ended Merit',
    };
    const oldEndedMerit: MeritIncentive = {
      apr: 2,
      link: 'https://merit.example/old',
      startDate: '2025-01-01',
      endDate: '2026-04-01',
      name: 'Old Ended Merit',
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
    const activeMerit: MeritIncentive = {
      apr: 5,
      link: 'https://merit.example',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      name: 'Active',
    };
    const reserve = mockReserve({ meritSupplys: [activeMerit] });
    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);
    expect(result).toEqual([]);
  });

  it('collects from all three source types (Merit, Merkl, Brevis)', () => {
    const endedMerit: MeritIncentive = {
      apr: 3,
      link: 'https://merit.example',
      startDate: '2026-01-01',
      endDate: '2026-05-10',
      name: 'Ended Merit',
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
    const endedMeritBorrow: MeritIncentive = {
      apr: 4,
      link: 'https://merit.example/borrow',
      startDate: '2026-01-01',
      endDate: '2026-05-12',
      name: 'Borrow Merit',
    };

    const reserve = mockReserve({
      meritSupplys: [], // supply side empty
      meritBorrows: [endedMeritBorrow],
    });

    const result = collectRecentlyEndedCampaigns(reserve, 'borrow', NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Borrow Merit');
  });

  it('handles Merit campaigns with selfApr as separate campaign entries', () => {
    const meritWithSelf: MeritIncentive = {
      apr: 3,
      selfApr: 2,
      link: 'https://merit.example',
      startDate: '2026-01-01',
      endDate: '2026-05-12',
      name: 'ACI Incentive',
    };

    const reserve = mockReserve({ meritSupplys: [meritWithSelf] });
    const result = collectRecentlyEndedCampaigns(reserve, 'supply', NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].campaigns).toHaveLength(2);
    expect(result[0].campaigns[0].apr).toBe(3);
    expect(result[0].campaigns[1].apr).toBe(2);
  });
});