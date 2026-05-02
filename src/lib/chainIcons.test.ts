import { describe, expect, it } from 'vitest';

import { getChainIconSrc } from './chainIcons';

describe('getChainIconSrc', () => {
  it('returns a public path when map and on-disk manifest both cover the chain', () => {
    const src = getChainIconSrc('Ethereum');
    expect(src).toBe('/icons/networks/ethereum.svg');
  });

  it('returns undefined when chain is unknown to the map', () => {
    expect(getChainIconSrc('TotallyUnknownChain999')).toBeUndefined();
  });
});
