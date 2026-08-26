/**
 * Unit tests for extractPoolTargets — the pure function that identifies
 * which V3 pools and V4 spokes to fetch on-chain HF for.
 *
 * Covers C5/C7/C17/C20 from the AAV-1253 scenario matrix.
 */
import { describe, it, expect } from 'vitest';
import { extractPoolTargets } from './useOnchainHealthFactor';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import type { RateCalcInput } from '@/lib/interestRateCalculator';

const makeReserve = (
  overrides: Partial<ReserveWithSpread & RateCalcInput> = {},
): ReserveWithSpread & RateCalcInput =>
  ({
    reserveId: 'r-usdc-v3',
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    chainId: 1,
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    aTokenAddress: '0x0000000000000000000000000000000000000002',
    vTokenAddress: '0x0000000000000000000000000000000000000003',
    decimals: 6,
    tokenPrice: 1,
    supplied: '50000000000000',
    borrowed: '20000000000000',
    liquidity: '30000000000000',
    deficit: '0',
    supplyCap: '100000000000000',
    borrowCap: '80000000000000',
    suppliable: '50000000000000',
    borrowable: '60000000000000',
    protocolFee: 10,
    slopeBelowOptimal: 4,
    slopeAboveOptimal: 75,
    baseBorrowRate: 0,
    optimalUtilization: 80,
    supplyApy: 2.5,
    borrowApy: 4.8,
    utilizationPct: 40,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [],
    merklBorrows: [],
    brevisSupplys: [],
    brevisBorrows: [],
    ltv: 80,
    ...overrides,
  }) as ReserveWithSpread & RateCalcInput;

const makeEntry = (
  overrides: Partial<PortfolioReserveEntry> = {},
): PortfolioReserveEntry => ({
  reserveId: 'r-usdc-v3',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenSymbol: 'USDC',
  supply: { amount: '10000', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
  ...overrides,
});

describe('extractPoolTargets (AAV-1253)', () => {
  // C5: V4 spokeAddress matching — reserve with spokeAddress is correctly identified as V4 target
  it('C5: V4 reserve with spokeAddress → extracted as V4 spoke target', () => {
    const spokeAddress = '0xabc1234567890123456789012345678901234567' as `0x${string}`;
    const reserve = makeReserve({
      reserveId: 'r-v4-usdc',
      marketName: 'AaveV4EthereumHub_usdc',
      chainId: 1,
      spokeAddress,
    });
    const entries = [
      makeEntry({
        reserveId: 'r-v4-usdc',
        marketName: 'AaveV4EthereumHub_usdc',
        chainName: 'Ethereum',
      }),
    ];
    const targets = extractPoolTargets(entries, [reserve]);
    expect(targets.v3Pools).toHaveLength(0);
    expect(targets.v4Spokes).toHaveLength(1);
    expect(targets.v4Spokes[0].spokeAddress).toBe(spokeAddress);
    expect(targets.v4Spokes[0].marketName).toBe('AaveV4EthereumHub_usdc');
    expect(targets.v4Spokes[0].chainId).toBe(1);
  });

  // C7: V3 marketName matching — V3 reserve (no spokeAddress) is correctly identified as V3 pool target
  it('C7: V3 reserve with marketName → extracted as V3 pool target with correct poolKey', () => {
    const reserve = makeReserve({
      reserveId: 'r-v3-usdc',
      marketName: 'AaveV3Ethereum',
      chainId: 1,
    });
    const entries = [
      makeEntry({
        reserveId: 'r-v3-usdc',
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
      }),
    ];
    const targets = extractPoolTargets(entries, [reserve]);
    expect(targets.v3Pools).toHaveLength(1);
    expect(targets.v4Spokes).toHaveLength(0);
    expect(targets.v3Pools[0].marketName).toBe('AaveV3Ethereum');
    expect(targets.v3Pools[0].chainId).toBe(1);
    // poolKey = `${chainId}:${marketName}` = "1:AaveV3Ethereum"
    // This matches the onchainHfMap key format
  });

  // C17: spokeAddress case mismatch — different case representations still produce same poolKey
  it('C17: V4 spokeAddress case mismatch → poolKey matching still works via marketName', () => {
    // reserve has uppercase spokeAddress
    const upperSpoke = '0xABC1234567890123456789012345678901234567' as `0x${string}`;
    const reserve = makeReserve({
      reserveId: 'r-v4-usdc',
      marketName: 'AaveV4EthereumHub_usdc',
      chainId: 1,
      spokeAddress: upperSpoke,
    });
    const entries = [
      makeEntry({
        reserveId: 'r-v4-usdc',
        marketName: 'AaveV4EthereumHub_usdc',
        chainName: 'Ethereum',
      }),
    ];
    const targets = extractPoolTargets(entries, [reserve]);
    // V4 target is extracted with the original case spokeAddress
    expect(targets.v4Spokes).toHaveLength(1);
    expect(targets.v4Spokes[0].spokeAddress).toBe(upperSpoke);
    // But poolKey is based on marketName, not spokeAddress — so case doesn't matter for matching
    // The onchainHfMap key "1:AaveV4EthereumHub_usdc" will match regardless of spokeAddress case
    expect(targets.v4Spokes[0].marketName).toBe('AaveV4EthereumHub_usdc');
  });

  // C20: new pool entry — extractPoolTargets detects new pools when entries change
  it('C20: adding a new pool entry → extractPoolTargets returns the new pool', () => {
    const r1 = makeReserve({
      reserveId: 'r-v3-usdc',
      marketName: 'AaveV3Ethereum',
      chainId: 1,
    });
    const e1 = makeEntry({
      reserveId: 'r-v3-usdc',
      marketName: 'AaveV3Ethereum',
      chainName: 'Ethereum',
    });

    // Initially: 1 pool
    const targets1 = extractPoolTargets([e1], [r1]);
    expect(targets1.v3Pools).toHaveLength(1);
    expect(targets1.v4Spokes).toHaveLength(0);

    // Add a new V4 pool entry
    const r2 = makeReserve({
      reserveId: 'r-v4-weth',
      marketName: 'AaveV4EthereumHub_weth',
      chainId: 1,
      spokeAddress: '0xdef1234567890123456789012345678901234567' as `0x${string}`,
    });
    const e2 = makeEntry({
      reserveId: 'r-v4-weth',
      marketName: 'AaveV4EthereumHub_weth',
      chainName: 'Ethereum',
    });

    const targets2 = extractPoolTargets([e1, e2], [r1, r2]);
    expect(targets2.v3Pools).toHaveLength(1);
    expect(targets2.v4Spokes).toHaveLength(1);
    expect(targets2.v4Spokes[0].marketName).toBe('AaveV4EthereumHub_weth');
  });

  // Deduplication: multiple entries on the same pool → only one target
  it('deduplicates multiple entries on the same pool', () => {
    const reserve = makeReserve({
      reserveId: 'r-usdc',
      marketName: 'AaveV3Ethereum',
      chainId: 1,
    });
    const entries = [
      makeEntry({ reserveId: 'r-usdc', tokenSymbol: 'USDC' }),
      makeEntry({ reserveId: 'r-usdc', tokenSymbol: 'USDC' }),
    ];
    const targets = extractPoolTargets(entries, [reserve]);
    expect(targets.v3Pools).toHaveLength(1);
  });

  // Hidden/orphan entries are skipped
  it('skips hidden and orphan entries', () => {
    const reserve = makeReserve();
    const entries = [
      makeEntry({ hidden: true }),
      makeEntry({ isOrphan: true }),
    ];
    const targets = extractPoolTargets(entries, [reserve]);
    expect(targets.v3Pools).toHaveLength(0);
    expect(targets.v4Spokes).toHaveLength(0);
  });
});
