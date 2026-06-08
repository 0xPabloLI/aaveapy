import { describe, expect, it } from 'vitest';

import { normalizeExplorerBase } from './explorerIconMap';
import { getExplorerBrand, getExplorerIconSrc } from './explorerIcons';

describe('getExplorerIconSrc', () => {
  it('returns a public path for the canonical Etherscan base', () => {
    expect(getExplorerIconSrc('https://etherscan.io')).toBe(
      '/icons/explorers/etherscan.svg',
    );
  });

  it('returns undefined for an unknown explorer base', () => {
    expect(getExplorerIconSrc('https://totally-unknown-explorer.example')).toBeUndefined();
  });

  it('resolves every mapped brand to a public path (Slice 2 complete)', () => {
    // After Slice 2 all 4 brands (etherscan/routescan/blockscout/oklink)
    // have landed on disk. The two-layer map+manifest must resolve every
    // base URL exposed in poolExplorerLinks → explorerIconMap to a path.
    expect(getExplorerIconSrc('https://etherscan.io')).toBe(
      '/icons/explorers/etherscan.svg',
    );
    expect(getExplorerIconSrc('https://metisscan.info')).toBe(
      '/icons/explorers/routescan.svg',
    );
    expect(getExplorerIconSrc('https://scrollscan.com')).toBe(
      '/icons/explorers/blockscout.svg',
    );
    expect(getExplorerIconSrc('https://www.oklink.com')).toBe(
      '/icons/explorers/oklink.svg',
    );
  });
});

describe('getExplorerBrand', () => {
  it('returns the icon base for a known explorer base', () => {
    expect(getExplorerBrand('https://etherscan.io')).toBe('etherscan');
  });

  it('returns undefined for an unknown explorer base', () => {
    expect(getExplorerBrand('https://totally-unknown-explorer.example')).toBeUndefined();
  });
});

describe('normalizeExplorerBase', () => {
  it('strips the protocol, lowercases, and drops the path', () => {
    expect(normalizeExplorerBase('https://optimistic.etherscan.io/address/0x123')).toBe(
      'optimistic.etherscan.io',
    );
  });

  it('strips a leading www. subdomain', () => {
    expect(normalizeExplorerBase('https://www.oklink.com/foo/bar')).toBe('oklink.com');
  });

  it('lowercases and trims surrounding whitespace', () => {
    expect(normalizeExplorerBase('  HTTPS://ETHERSCAN.IO  ')).toBe('etherscan.io');
  });
});
