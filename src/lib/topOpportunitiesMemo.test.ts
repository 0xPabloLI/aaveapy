import { describe, expect, it } from 'vitest';

import { shouldSkipTopOpportunitiesRender } from './topOpportunitiesMemo';

const makeProps = () => ({
  isApy: true,
  tydroPointToUsdRate: 1,
  isRateDragging: false,
  onIncentiveClick: undefined,
  categoryGroups: {},
  includeWhitelistOnlyMerkl: false,
  reserves: [
    { marketName: 'AaveV3Ethereum', tokenAddress: '0x1' },
    { marketName: 'AaveV3Base', tokenAddress: '0x2' },
  ],
});

describe('shouldSkipTopOpportunitiesRender', () => {
  it('returns false when whitelist toggle changes', () => {
    const prev = makeProps();
    const next = { ...makeProps(), includeWhitelistOnlyMerkl: true };

    expect(shouldSkipTopOpportunitiesRender(prev, next)).toBe(false);
  });

  it('returns true when reserve identity ordering is unchanged', () => {
    const prev = makeProps();
    const next = {
      ...prev,
      reserves: [...prev.reserves],
    };

    expect(shouldSkipTopOpportunitiesRender(prev, next)).toBe(true);
  });

  it('returns false when reserve order changes', () => {
    const prev = makeProps();
    const next = { ...makeProps(), reserves: [...makeProps().reserves].reverse() };

    expect(shouldSkipTopOpportunitiesRender(prev, next)).toBe(false);
  });
});
