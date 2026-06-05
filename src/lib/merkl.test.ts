import { describe, it, expect } from 'vitest';
import { getFirstActiveMerklLink } from './merkl';
import type { MerklOpportunityGroup, MerklCampaignBreakdown } from '@/types/aave';

const NOW_MS = new Date('2026-05-15T12:00:00Z').getTime();

function msFromNow(daysOffset: number, timeStr = 'T12:00:00.000Z'): string {
  const d = new Date(NOW_MS + daysOffset * 24 * 60 * 60 * 1000);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}${timeStr}`;
}

function breakdown(overrides: Partial<MerklCampaignBreakdown> = {}): MerklCampaignBreakdown {
  return {
    campaignApr: 3.2,
    campaignStartedAt: msFromNow(-10),
    campaignEndedAt: msFromNow(10),
    campaignId: 'camp-1',
    ...overrides,
  };
}

function group(overrides: Partial<MerklOpportunityGroup> = {}): MerklOpportunityGroup {
  return {
    link: 'https://merkl.example/opp',
    breakdowns: [breakdown()],
    ...overrides,
  };
}

describe('getFirstActiveMerklLink', () => {
  it('returns null for undefined input', () => {
    expect(getFirstActiveMerklLink(undefined, NOW_MS)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getFirstActiveMerklLink([], NOW_MS)).toBeNull();
  });

  it('returns link of first group with active breakdown', () => {
    const items = [group({ link: 'https://a.com' }), group({ link: 'https://b.com' })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://a.com');
  });

  it('skips group with no link', () => {
    const items = [group({ link: undefined }), group({ link: 'https://b.com' })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://b.com');
  });

  it('skips group whose breakdowns are all expired', () => {
    const items = [group({ link: 'https://a.com', breakdowns: [breakdown({ campaignEndedAt: msFromNow(-5) })] })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBeNull();
  });

  it('skips group whose breakdowns have not started', () => {
    const items = [group({ link: 'https://a.com', breakdowns: [breakdown({ campaignStartedAt: msFromNow(5) })] })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBeNull();
  });

  it('returns group link if at least one breakdown is active', () => {
    const items = [
      group({
        link: 'https://mixed.com',
        breakdowns: [
          breakdown({ campaignEndedAt: msFromNow(-5) }),
          breakdown(),
        ],
      }),
    ];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://mixed.com');
  });

  it('skips groups with empty breakdowns array', () => {
    const items = [group({ link: 'https://a.com', breakdowns: [] }), group({ link: 'https://b.com' })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://b.com');
  });

  it('uses Date.now() as default for nowMs', () => {
    const now = Date.now();
    const items = [group({
      link: 'https://live.com',
      breakdowns: [breakdown({
        campaignStartedAt: new Date(now - 86400000).toISOString(),
        campaignEndedAt: new Date(now + 86400000).toISOString(),
      })],
    })];
    expect(getFirstActiveMerklLink(items)).toBe('https://live.com');
  });

  it('allows open-ended breakdowns (allowOpenEnd=true) when endDate is missing', () => {
    const items = [group({
      link: 'https://open.com',
      breakdowns: [breakdown({ campaignEndedAt: undefined as unknown as string })],
    })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://open.com');
  });

  it('supports date-only format for campaign dates', () => {
    const items = [group({
      breakdowns: [breakdown({ campaignStartedAt: '2026-05-01', campaignEndedAt: '2026-06-01' })],
    })];
    expect(getFirstActiveMerklLink(items, NOW_MS)).toBe('https://merkl.example/opp');
  });
});
