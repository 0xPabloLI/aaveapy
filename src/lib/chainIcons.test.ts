import { describe, expect, it } from 'vitest';

import { getChainIconSrc } from './chainIcons';

describe('getChainIconSrc', () => {
  it('returns a public path when map and on-disk manifest both cover the chain', () => {
    const src = getChainIconSrc(1);
    expect(src).toBe('/icons/networks/ethereum.svg');
  });

  it('returns undefined when chainId is unknown', () => {
    expect(getChainIconSrc(999999)).toBeUndefined();
  });

  it('returns monad icon for chain ID 143', () => {
    const src = getChainIconSrc(143);
    expect(src).toBe('/icons/networks/monad.svg');
  });
});
