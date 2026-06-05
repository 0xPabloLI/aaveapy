import { describe, it, expect } from 'vitest';
import { getFirstActiveMeritLink } from './merit';
import type { MeritIncentive } from '@/types/aave';

const NOW_MS = new Date('2026-05-15T12:00:00Z').getTime();

function msFromNow(daysOffset: number, timeStr = 'T12:00:00.000Z'): string {
  const d = new Date(NOW_MS + daysOffset * 24 * 60 * 60 * 1000);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}${timeStr}`;
}

function merit(overrides: Partial<MeritIncentive> = {}): MeritIncentive {
  return {
    apr: 5,
    link: 'https://merit.example/campaign',
    startDate: msFromNow(-10),
    endDate: msFromNow(10),
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

  it('returns link of first active merit', () => {
    const items = [merit({ link: 'https://a.com' }), merit({ link: 'https://b.com' })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://a.com');
  });

  it('skips merit with no link', () => {
    const items = [merit({ link: '' }), merit({ link: 'https://b.com' })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://b.com');
  });

  it('skips merit that has not started yet', () => {
    const items = [merit({ startDate: msFromNow(5), endDate: msFromNow(30) })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('skips merit that has already ended', () => {
    const items = [merit({ startDate: msFromNow(-30), endDate: msFromNow(-5) })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('returns null when all merits are inactive', () => {
    const items = [
      merit({ startDate: msFromNow(1), endDate: msFromNow(30) }),
      merit({ startDate: msFromNow(-30), endDate: msFromNow(-1) }),
    ];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });

  it('finds active merit after skipping inactive ones', () => {
    const items = [
      merit({ startDate: msFromNow(-30), endDate: msFromNow(-5), link: 'https://expired.com' }),
      merit({ link: 'https://active.com' }),
    ];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://active.com');
  });

  it('uses Date.now() as default for nowMs', () => {
    const now = Date.now();
    const items = [merit({ startDate: new Date(now - 86400000).toISOString(), endDate: new Date(now + 86400000).toISOString() })];
    const result = getFirstActiveMeritLink(items);
    expect(result).toBe('https://merit.example/campaign');
  });

  it('supports date-only format (YYYY-MM-DD) for startDate/endDate', () => {
    const items = [merit({ startDate: '2026-05-01', endDate: '2026-06-01' })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBe('https://merit.example/campaign');
  });

  it('treats date-only endDate as end of day', () => {
    const NOW_END_OF_15TH = new Date('2026-05-15T23:59:59.999Z').getTime();
    const items = [merit({ startDate: '2026-05-01', endDate: '2026-05-15' })];
    expect(getFirstActiveMeritLink(items, NOW_END_OF_15TH)).toBe('https://merit.example/campaign');
  });

  it('treats date-only startDate as start of day', () => {
    const NOW_START_OF_15TH = new Date('2026-05-15T00:00:00.000Z').getTime();
    const items = [merit({ startDate: '2026-05-15', endDate: '2026-06-01' })];
    expect(getFirstActiveMeritLink(items, NOW_START_OF_15TH)).toBe('https://merit.example/campaign');
  });

  it('does not allow open end — merit with missing endDate is skipped', () => {
    const items = [merit({ startDate: msFromNow(-10), endDate: undefined as unknown as string })];
    expect(getFirstActiveMeritLink(items, NOW_MS)).toBeNull();
  });
});
