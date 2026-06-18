import { describe, it, expect } from 'vitest';
import { isCampaignActive, parseCampaignBoundaryMs } from './campaignGroups';

const NOW_MS = new Date('2026-06-18T12:00:00.000Z').getTime();

describe('parseCampaignBoundaryMs', () => {
  it('parses ISO date-time as-is without timezone shift', () => {
    const result = parseCampaignBoundaryMs('2026-06-18T23:59:59.999Z', 'end');
    expect(result).toBe(new Date('2026-06-18T23:59:59.999Z').getTime());
  });

  it('parses ISO date-time for start boundary', () => {
    const result = parseCampaignBoundaryMs('2026-06-04T00:00:00.000Z', 'start');
    expect(result).toBe(new Date('2026-06-04T00:00:00.000Z').getTime());
  });

  it('returns null for undefined', () => {
    expect(parseCampaignBoundaryMs(undefined, 'end')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCampaignBoundaryMs('', 'end')).toBeNull();
  });
});

describe('isCampaignActive with ISO dates (Merit scenario)', () => {
  it('returns true when endDate is ISO and still in the future', () => {
    expect(isCampaignActive('2026-06-04T00:00:00.000Z', '2026-06-18T23:59:59.999Z', NOW_MS)).toBe(true);
  });

  it('returns true when now equals ISO endDate exactly', () => {
    const endMs = new Date('2026-06-18T23:59:59.999Z').getTime();
    expect(isCampaignActive('2026-06-04T00:00:00.000Z', '2026-06-18T23:59:59.999Z', endMs)).toBe(true);
  });

  it('returns false when ISO endDate has passed', () => {
    expect(isCampaignActive('2026-06-04T00:00:00.000Z', '2026-06-17T16:00:00.000Z', NOW_MS)).toBe(false);
  });

  it('returns false when ISO startDate is in the future', () => {
    expect(isCampaignActive('2026-07-01T00:00:00.000Z', '2026-07-15T00:00:00.000Z', NOW_MS)).toBe(false);
  });

  it('returns false when both dates are in the past (ISO)', () => {
    expect(isCampaignActive('2026-05-01T00:00:00.000Z', '2026-05-15T00:00:00.000Z', NOW_MS)).toBe(false);
  });

  it('returns false for empty endDate (no allowOpenEnd)', () => {
    expect(isCampaignActive('2026-06-04T00:00:00.000Z', '', NOW_MS, false)).toBe(false);
  });

  it('returns true for empty endDate when allowOpenEnd is true', () => {
    expect(isCampaignActive('2026-06-04T00:00:00.000Z', '', NOW_MS, true)).toBe(true);
  });
});
