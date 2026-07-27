import { describe, it, expect } from 'vitest';
import { slugifyMarketLabel, resolveMarketSlugs } from './marketSlug';
import type { MarketListItem } from '@/types/aave';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ETH_MARKETS: MarketListItem[] = [
  { marketName: 'AaveV3Ethereum', chainName: 'Ethereum', chainId: 1 },
  { marketName: 'AaveV3EthereumLido', chainName: 'Ethereum', chainId: 1 },
  { marketName: 'AaveV3EthereumEtherFi', chainName: 'Ethereum', chainId: 1 },
  { marketName: 'AaveV3EthereumHorizon', chainName: 'Ethereum', chainId: 1 },
  { marketName: 'AaveV4Ethereum', chainName: 'Ethereum', chainId: 1 },
  { marketName: 'AaveV4EthereumLido', chainName: 'Ethereum', chainId: 1 },
];

const BASE_MARKETS: MarketListItem[] = [
  { marketName: 'AaveV3Base', chainName: 'Base', chainId: 8453 },
];

const ALL_MARKETS = [...ETH_MARKETS, ...BASE_MARKETS];

// ── S1–S4: slugifyMarketLabel ─────────────────────────────────────────────────

describe('slugifyMarketLabel', () => {
  // S1: V3 Ethereum Core
  it('slugifies AaveV3Ethereum to "core"', () => {
    expect(slugifyMarketLabel('AaveV3Ethereum')).toBe('core');
  });

  // S2: multi-word label (Horizon RWA)
  it('slugifies AaveV3EthereumHorizon to "horizon-rwa"', () => {
    expect(slugifyMarketLabel('AaveV3EthereumHorizon')).toBe('horizon-rwa');
  });

  // S3: V4 market
  it('slugifies AaveV4EthereumLido to "ethereum-lido"', () => {
    expect(slugifyMarketLabel('AaveV4EthereumLido')).toBe('ethereum-lido');
  });

  // S4: single-market chain
  it('slugifies AaveV3Base to "base"', () => {
    expect(slugifyMarketLabel('AaveV3Base')).toBe('base');
  });

  // Additional coverage
  it('slugifies AaveV3EthereumLido to "prime"', () => {
    expect(slugifyMarketLabel('AaveV3EthereumLido')).toBe('prime');
  });

  it('slugifies AaveV3EthereumEtherFi to "etherfi"', () => {
    expect(slugifyMarketLabel('AaveV3EthereumEtherFi')).toBe('etherfi');
  });

  it('slugifies AaveV4Ethereum to "ethereum"', () => {
    expect(slugifyMarketLabel('AaveV4Ethereum')).toBe('ethereum');
  });
});

// ── S5–S9: resolveMarketSlugs ─────────────────────────────────────────────────

describe('resolveMarketSlugs', () => {
  // S5: single valid slug
  it('resolves a single valid slug to marketKey', () => {
    const result = resolveMarketSlugs(['core'], 1, ETH_MARKETS);
    expect(result.resolved).toEqual(['1:AaveV3Ethereum']);
    expect(result.invalid).toEqual([]);
  });

  // S6: multiple valid slugs
  it('resolves multiple valid slugs', () => {
    const result = resolveMarketSlugs(['core', 'prime'], 1, ETH_MARKETS);
    expect(result.resolved).toEqual(['1:AaveV3Ethereum', '1:AaveV3EthereumLido']);
    expect(result.invalid).toEqual([]);
  });

  // S7: nonexistent slug
  it('returns empty resolved and collects invalid for nonexistent slug', () => {
    const result = resolveMarketSlugs(['nonexistent'], 1, ETH_MARKETS);
    expect(result.resolved).toEqual([]);
    expect(result.invalid).toEqual(['nonexistent']);
  });

  // S8: mixed valid + invalid
  it('returns partial results for mixed valid and invalid slugs', () => {
    const result = resolveMarketSlugs(['core', 'xxx'], 1, ETH_MARKETS);
    expect(result.resolved).toEqual(['1:AaveV3Ethereum']);
    expect(result.invalid).toEqual(['xxx']);
  });

  // S9: empty slug array
  it('returns empty arrays for empty slug input', () => {
    const result = resolveMarketSlugs([], 1, ETH_MARKETS);
    expect(result.resolved).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  // Chain isolation: only resolves markets matching chainId
  it('only resolves markets matching the specified chainId', () => {
    const result = resolveMarketSlugs(['base'], 8453, ALL_MARKETS);
    expect(result.resolved).toEqual(['8453:AaveV3Base']);
    expect(result.invalid).toEqual([]);
  });

  // Cross-chain: slug from different chain is invalid
  it('does not resolve a slug from a different chain', () => {
    const result = resolveMarketSlugs(['core'], 8453, ALL_MARKETS);
    expect(result.resolved).toEqual([]);
    expect(result.invalid).toEqual(['core']);
  });
});
