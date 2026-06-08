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

  it('returns undefined when a known base has no on-disk asset yet', () => {
    // BlockScout/Routescan/OKLink bases are mapped but only `etherscan.svg`
    // has landed on disk in this slice. The two-layer map+manifest design
    // must short-circuit to undefined for not-yet-illustrated explorers.
    expect(getExplorerIconSrc('https://www.oklink.com')).toBeUndefined();
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
