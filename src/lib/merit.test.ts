import { describe, it, expect } from 'vitest';
import { getFirstActiveMeritLink } from './merit';
import type { MeritCampaignGroup } from '@/types/aave';

const NOW_MS = new Date('2026-05-15T12:00:00Z').getTime();

function msFromNow(daysOffset: number, timeStr = 'T12:00:00.000Z'): string {
  const d = new Date(NOW_MS + daysOffset * 24 * 60 * 60 * 1000);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}${timeStr}`;
}

function meritGroup(overrides: Partial<MeritCampaignGroup> = {}): MeritCampaignGroup {
  return {
    link: 'https://merit.example/campaign',
    breakdowns: [{
      campaignApr: 5,
      campaignStartedAt: msFromNow(-10),
      campaignEndedAt: msFromNow(10),
      campaignId: 'merit-1',
    }],
    ...overrides,
  };
}

describe('getFirstActiveMeritLink', () => {
  it('returns null for undefined input', () => {
    expect(getFirstActiveMeritLink(undefined, NOW_MS)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getFirstActiveMeritLink([], NOW_MS)).toBeNull();
  });

  it('returns link of first active merit group', () => {
    const items = [meritGroup({ link: 'https://a.com' }), meritGroup({ link: 'https://b.com' })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://a.com');
  });

  it('skips group with no link', () => {
    const items = [meritGroup({ link: '' }), meritGroup({ link: 'https://b.com' })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://b.com');
  });

  it('skips group whose breakdowns have not started yet', () => {
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: msFromNow(5),
        campaignEndedAt: msFromNow(30),
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('skips group whose breakdowns have already ended', () => {
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: msFromNow(-30),
        campaignEndedAt: msFromNow(-5),
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('returns null when all groups are inactive', () => {
    const items = [
      meritGroup({
        breakdowns: [{
          campaignApr: 5,
          campaignStartedAt: msFromNow(1),
          campaignEndedAt: msFromNow(30),
          campaignId: 'merit-1',
        }],
      }),
      meritGroup({
        breakdowns: [{
          campaignApr: 5,
          campaignStartedAt: msFromNow(-30),
          campaignEndedAt: msFromNow(-1),
          campaignId: 'merit-2',
        }],
      }),
    ];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('finds active group after skipping inactive ones', () => {
    const items = [
      meritGroup({
        link: 'https://expired.com',
        breakdowns: [{
          campaignApr: 5,
          campaignStartedAt: msFromNow(-30),
          campaignEndedAt: msFromNow(-5),
          campaignId: 'merit-1',
        }],
      }),
      meritGroup({ link: 'https://active.com' }),
    ];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://active.com');
  });

  it('uses Date.now() as default for nowMs', () => {
    const now = Date.now();
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: new Date(now - 86400000).toISOString(),
        campaignEndedAt: new Date(now + 86400000).toISOString(),
        campaignId: 'merit-1',
      }],
    })];
    const result = getFirstActiveMeritLink(items);
    expect(result).toBe('https://merit.example/campaign');
  });

  it('supports date-only format (YYYY-MM-DD) for startDate/endDate', () => {
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2026-05-01',
        campaignEndedAt: '2026-06-01',
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://merit.example/campaign');
  });

  it('treats date-only endDate as end of day', () => {
    const NOW_END_OF_15TH = new Date('2026-05-15T23:59:59.999Z').getTime();
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2026-05-01',
        campaignEndedAt: '2026-05-15',
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_END_OF_15TH)).toBe('https://merit.example/campaign');
  });

  it('treats date-only startDate as start of day', () => {
    const NOW_START_OF_15TH = new Date('2026-05-15T00:00:00.000Z').getTime();
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2026-05-15',
        campaignEndedAt: '2026-06-01',
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_START_OF_15TH)).toBe('https://merit.example/campaign');
  });

  it('does not allow open end — group with missing endDate breakdown is skipped', () => {
    const items = [meritGroup({
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: msFromNow(-10),
        campaignEndedAt: undefined as unknown as string,
        campaignId: 'merit-1',
      }],
    })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });
});
