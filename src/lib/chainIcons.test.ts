import { describe, expect, it } from 'vitest';

import { getChainIconSrc, getChainIconSources, getChainIconSourcesForBase } from './chainIcons';

describe('getChainIconSrc', () => {
  it('returns a public path when map and on-disk manifest both cover the chain', () => {
    const src = getChainIconSrc('Ethereum');
    expect(src).toBe('/icons/networks/ethereum.svg');
  });

  it('returns undefined when chain is unknown to the map', () => {
    expect(getChainIconSrc('TotallyUnknownChain999')).toBeUndefined();
  });
});

describe('getChainIconSources', () => {
  it('lists manifest extensions in preferred order for a mapped chain', () => {
    const sources = getChainIconSources('Base');
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0]).toMatch(/^\/icons\/networks\/base\.(svg|webp|png|jpe?g)$/);
  });

  it('returns empty list when base has no files in manifest', () => {
    expect(getChainIconSourcesForBase('definitely-missing-chain-icon-xyz')).toEqual([]);
  });
});
