import { describe, expect, it } from 'vitest';
import {
  isMerklWhitelistBreakdownIncluded,
  MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL,
  MERKL_WHITELIST_TOGGLE_LABEL,
  MERKL_WHITELIST_TOGGLE_ARIA,
} from './merklWhitelist';

describe('MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL', () => {
  it('is a non-empty string constant', () => {
    expect(MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL).toBe('__merklWhitelistNoCampaignId__');
  });
});

describe('MERKL_WHITELIST_TOGGLE_LABEL', () => {
  it('is a non-empty string', () => {
    expect(MERKL_WHITELIST_TOGGLE_LABEL.length).toBeGreaterThan(0);
  });
});

describe('MERKL_WHITELIST_TOGGLE_ARIA', () => {
  it('is a non-empty string', () => {
    expect(MERKL_WHITELIST_TOGGLE_ARIA.length).toBeGreaterThan(0);
  });
});

describe('isMerklWhitelistBreakdownIncluded', () => {
  it('always includes non-whitelist breakdowns', () => {
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: false, campaignId: 'abc' }, undefined)).toBe(true);
    expect(isMerklWhitelistBreakdownIncluded({ campaignId: 'abc' }, undefined)).toBe(true);
  });

  it('excludes whitelist-only when set is undefined', () => {
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'abc' }, undefined)).toBe(false);
  });

  it('includes whitelist-only when campaignId is in the set', () => {
    const set = new Set(['abc', 'def']);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'abc' }, set)).toBe(true);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'xyz' }, set)).toBe(false);
  });

  it('uses sentinel when campaignId is empty/blank', () => {
    const set = new Set([MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL]);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: '' }, set)).toBe(true);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: '  ' }, set)).toBe(true);
  });

  it('excludes empty-campaignId whitelist-only when sentinel is not in set', () => {
    const set = new Set(['abc']);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: '' }, set)).toBe(false);
  });

  it('excludes blacklisted campaigns regardless of whitelist toggle', () => {
    const set = new Set(['abc']);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: false, campaignId: 'abc' }, set, 'blacklisted')).toBe(false);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'abc' }, set, 'blacklisted')).toBe(false);
  });

  it('excludes whitelist-blocked campaigns regardless of whitelist toggle', () => {
    const set = new Set(['abc']);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: false, campaignId: 'abc' }, set, 'whitelist-blocked')).toBe(false);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'abc' }, set, 'whitelist-blocked')).toBe(false);
  });

  it('allows campaigns with "allowed" access status (same as omitting)', () => {
    const set = new Set(['abc']);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: false, campaignId: 'abc' }, set, 'allowed')).toBe(true);
    expect(isMerklWhitelistBreakdownIncluded({ whitelistOnly: true, campaignId: 'abc' }, set, 'allowed')).toBe(true);
  });
});
