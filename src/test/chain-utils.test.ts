import { describe, expect, it } from 'vitest';
import { shouldIncludeModule, discoverMainnetChainIds } from '../../scripts/lib/chain-utils.mjs';

describe('shouldIncludeModule', () => {
  it('excludes base modules (namespace prefixes)', () => {
    expect(shouldIncludeModule('AaveV3')).toBe(false);
    expect(shouldIncludeModule('AaveV4')).toBe(false);
  });

  it('excludes testnet modules', () => {
    expect(shouldIncludeModule('AaveV3Sepolia')).toBe(false);
    expect(shouldIncludeModule('AaveV3EthereumSepolia')).toBe(false);
    expect(shouldIncludeModule('AaveV4Fuji')).toBe(false);
    expect(shouldIncludeModule('AaveV3Testnet')).toBe(false);
  });

  it('excludes skipped chains', () => {
    expect(shouldIncludeModule('AaveV3Fantom')).toBe(false);
    expect(shouldIncludeModule('AaveV3Harmony')).toBe(false);
  });

  it('excludes Ethereum sub-pools', () => {
    expect(shouldIncludeModule('AaveV3EthereumEtherFi')).toBe(false);
    expect(shouldIncludeModule('AaveV3EthereumHorizon')).toBe(false);
    expect(shouldIncludeModule('AaveV3EthereumLido')).toBe(false);
  });

  it('includes valid mainnet modules', () => {
    expect(shouldIncludeModule('AaveV3Ethereum')).toBe(true);
    expect(shouldIncludeModule('AaveV3Arbitrum')).toBe(true);
    expect(shouldIncludeModule('AaveV3Optimism')).toBe(true);
    expect(shouldIncludeModule('AaveV3Polygon')).toBe(true);
    expect(shouldIncludeModule('AaveV3Base')).toBe(true);
    expect(shouldIncludeModule('AaveV3BNB')).toBe(true);
    expect(shouldIncludeModule('AaveV3Sonic')).toBe(true);
  });
});

describe('discoverMainnetChainIds', () => {
  it('returns a non-empty set of chain IDs', async () => {
    const ids = await discoverMainnetChainIds();
    expect(ids.size).toBeGreaterThan(0);
  }, 30000);

  it('includes known mainnet chain IDs', async () => {
    const ids = await discoverMainnetChainIds();
    expect(ids.has(1)).toBe(true);
    expect(ids.has(42161)).toBe(true);
    expect(ids.has(10)).toBe(true);
    expect(ids.has(137)).toBe(true);
    expect(ids.has(8453)).toBe(true);
  });

  it('does not include testnet chain IDs', async () => {
    const ids = await discoverMainnetChainIds();
    expect(ids.has(11155111)).toBe(false);
  });

  it('does not include sub-pool chain IDs as duplicates', async () => {
    const ids = await discoverMainnetChainIds();
    const ethereumCount = [...ids].filter((id) => id === 1).length;
    expect(ethereumCount).toBe(1);
  });
});
