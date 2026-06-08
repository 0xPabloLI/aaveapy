import { describe, it, expect } from 'vitest';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioReserveEntry, PortfolioSideData } from '@/types/portfolio';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import type { SimulationLane } from '@/lib/rateSimulationCalculator';
import { simulatePortfolioPositions, buildPerReserveInputsFromEntries, buildMetricsFromLane, simulatePortfolioFromEntries } from './portfolioSimulator';
import type { SimulatePortfolioPositionsArgs, SimulatePortfolioEntriesArgs } from './portfolioSimulator';

const makeRateCalcReserve = (
  overrides: Partial<ReserveWithSpread> = {},
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
    ...overrides,
  }) as ReserveWithSpread & RateCalcInput;

type InlinePosition = {
  reserveId: string;
  side: 'supply' | 'borrow';
  amount: string;
  inputMode: 'usd' | 'token';
  walletValue: number | null;
  hidden: boolean;
  isOrphan: boolean;
  deltaSign?: 1 | -1;
};

const makePosition = (
  overrides: Partial<InlinePosition> = {},
): InlinePosition => ({
  reserveId: 'r-usdc-v3',
  side: 'supply',
  amount: '10000',
  inputMode: 'usd',
  walletValue: null,
  hidden: false,
  isOrphan: false,
  ...overrides,
});

const emptySide: PortfolioSideData = { amount: '', inputMode: 'usd', walletValue: null };

const makeEntry = (
  overrides: Partial<PortfolioReserveEntry> = {},
): PortfolioReserveEntry => ({
  reserveId: 'r-usdc-v3',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'USDC',
  supply: { amount: '10000', inputMode: 'usd', walletValue: null },
  borrow: { ...emptySide },
  hidden: false,
  isOrphan: false,
  ...overrides,
});

const baseSimArgs = (
  overrides: Partial<SimulatePortfolioPositionsArgs> = {},
): SimulatePortfolioPositionsArgs => ({
  positions: [],
  reserves: [],
  isApy: true,
  whitelistMerklCampaignIds: undefined,
  tydroPointToUsdRate: 0,
  forecastStates: {},
  ...overrides,
});

const baseEntriesSimArgs = (
  overrides: Partial<SimulatePortfolioEntriesArgs> = {},
): SimulatePortfolioEntriesArgs => ({
  entries: [],
  reserves: [],
  isApy: true,
  whitelistMerklCampaignIds: undefined,
  tydroPointToUsdRate: 0,
  forecastStates: {},
  ...overrides,
});

describe('buildPerReserveInputsFromEntries', () => {
  it('aggregates supply+borrow USD per reserveId', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', tokenSymbol: 'USDC', supply: { amount: '1000', inputMode: 'usd', walletValue: null }, borrow: { amount: '500', inputMode: 'usd', walletValue: null } }),
      makeEntry({ reserveId: 'r-weth', tokenSymbol: 'WETH', supply: { amount: '2000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [
      makeRateCalcReserve({ reserveId: 'r-usdc', tokenSymbol: 'USDC', tokenPrice: 1 }),
      makeRateCalcReserve({ reserveId: 'r-weth', tokenSymbol: 'WETH', tokenPrice: 3000 }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.get('r-usdc')).toEqual({
      supplyInput: '1000',
      borrowInput: '500',
      inputMode: 'usd',
      principalSupplyUsd: 1000,
      principalBorrowUsd: 500,
    });
    expect(result.get('r-weth')).toEqual({
      supplyInput: '2000',
      borrowInput: '0',
      inputMode: 'usd',
      principalSupplyUsd: 2000,
      principalBorrowUsd: 0,
    });
  });

  it('returns empty map for empty entries', () => {
    const result = buildPerReserveInputsFromEntries([], [makeRateCalcReserve()]);
    expect(result.size).toBe(0);
  });

  it('skips entries with zero or invalid amount', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', supply: { amount: '0', inputMode: 'usd', walletValue: null }, borrow: { amount: 'abc', inputMode: 'usd', walletValue: null } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.size).toBe(0);
  });

  it('skips entries whose reserve is not found', () => {
    const entries = [
      makeEntry({ reserveId: 'r-missing', supply: { amount: '1000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.size).toBe(0);
  });

  it('defaults borrowInput to "0" when only supply exists', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', supply: { amount: '3000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.get('r-usdc')).toEqual({ supplyInput: '3000', borrowInput: '0', inputMode: 'usd', principalSupplyUsd: 3000, principalBorrowUsd: 0 });
  });

  it('defaults supplyInput to "0" when only borrow exists', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', supply: { ...emptySide }, borrow: { amount: '2000', inputMode: 'usd', walletValue: null } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.get('r-usdc')).toEqual({ supplyInput: '0', borrowInput: '2000', inputMode: 'usd', principalSupplyUsd: 0, principalBorrowUsd: 2000 });
  });

  it('resolves token amount to USD using tokenPrice', () => {
    const entries = [
      makeEntry({ reserveId: 'r-weth', tokenSymbol: 'WETH', supply: { amount: '2', inputMode: 'token', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-weth', tokenSymbol: 'WETH', tokenPrice: 3000 })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.get('r-weth')).toEqual({ supplyInput: '6000', borrowInput: '0', inputMode: 'usd', principalSupplyUsd: 6000, principalBorrowUsd: 0 });
  });

  it('ignores hidden entries', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', hidden: true, supply: { amount: '1000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.size).toBe(0);
  });

  it('ignores orphan entries', () => {
    const entries = [
      makeEntry({ reserveId: 'r-usdc', isOrphan: true, supply: { amount: '1000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const reserves = [makeRateCalcReserve({ reserveId: 'r-usdc' })];
    const result = buildPerReserveInputsFromEntries(entries, reserves);
    expect(result.size).toBe(0);
  });

  it('builds per-reserve inputs from supply side', () => {
    const reserveId = 'r-usdc-v3';
    const reserve = makeRateCalcReserve({ reserveId });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '5000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    expect(result.has(reserveId)).toBe(true);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('5000');
    expect(input.borrowInput).toBe('0');
    expect(input.inputMode).toBe('usd');
    expect(input.principalSupplyUsd).toBe(5000);
    expect(input.principalBorrowUsd).toBe(0);
  });

  it('builds per-reserve inputs from borrow side', () => {
    const reserveId = 'r-usdc-v3';
    const reserve = makeRateCalcReserve({ reserveId });
    const entries = [
      makeEntry({ reserveId, supply: { ...emptySide }, borrow: { amount: '3000', inputMode: 'usd', walletValue: null } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    expect(result.has(reserveId)).toBe(true);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('0');
    expect(input.borrowInput).toBe('3000');
    expect(input.inputMode).toBe('usd');
    expect(input.principalSupplyUsd).toBe(0);
    expect(input.principalBorrowUsd).toBe(3000);
  });

  it('combines supply and borrow on same reserve', () => {
    const reserveId = 'r-usdc-v3';
    const reserve = makeRateCalcReserve({ reserveId });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '5000', inputMode: 'usd', walletValue: null }, borrow: { amount: '3000', inputMode: 'usd', walletValue: null } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('5000');
    expect(input.borrowInput).toBe('3000');
    expect(input.principalSupplyUsd).toBe(5000);
    expect(input.principalBorrowUsd).toBe(3000);
  });

  it('returns empty map when no entries match reserves', () => {
    const reserve = makeRateCalcReserve({ reserveId: 'r-usdc-v3' });
    const entries = [
      makeEntry({ reserveId: 'r-dai-v3', supply: { amount: '5000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    expect(result.size).toBe(0);
  });

  it('handles multiple reserves independently', () => {
    const usdcId = 'r-usdc-v3';
    const usdtId = 'r-usdt-v3';
    const usdcReserve = makeRateCalcReserve({ reserveId: usdcId, tokenSymbol: 'USDC' });
    const usdtReserve = makeRateCalcReserve({ reserveId: usdtId, tokenSymbol: 'USDT' });
    const entries = [
      makeEntry({ reserveId: usdcId, tokenSymbol: 'USDC', supply: { amount: '5000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
      makeEntry({ reserveId: usdtId, tokenSymbol: 'USDT', supply: { ...emptySide }, borrow: { amount: '2000', inputMode: 'usd', walletValue: null } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [usdcReserve, usdtReserve]);
    expect(result.get(usdcId)!.supplyInput).toBe('5000');
    expect(result.get(usdcId)!.borrowInput).toBe('0');
    expect(result.get(usdcId)!.principalSupplyUsd).toBe(5000);
    expect(result.get(usdcId)!.principalBorrowUsd).toBe(0);
    expect(result.get(usdtId)!.supplyInput).toBe('0');
    expect(result.get(usdtId)!.borrowInput).toBe('2000');
    expect(result.get(usdtId)!.principalSupplyUsd).toBe(0);
    expect(result.get(usdtId)!.principalBorrowUsd).toBe(2000);
  });

  it('wallet position unchanged: delta=0, principal=walletValue', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('0');
    expect(input.principalSupplyUsd).toBe(1000);
  });

  it('wallet position with top-up: delta=positive, principal=effectiveAmount', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '1500', inputMode: 'usd', walletValue: 1000 }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('500');
    expect(input.principalSupplyUsd).toBe(1500);
  });

  it('wallet position with partial withdrawal: delta=negative, principal=effectiveAmount', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '500', inputMode: 'usd', walletValue: 1000 }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('-500');
    expect(input.principalSupplyUsd).toBe(500);
  });

  it('manual position (walletValue=null): delta=full amount, principal=full amount', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '2000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('2000');
    expect(input.principalSupplyUsd).toBe(2000);
  });

  it('mixed wallet + manual entries on same reserve: deltas aggregated', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { amount: '1500', inputMode: 'usd', walletValue: 1000 }, borrow: { ...emptySide } }),
      makeEntry({ reserveId, supply: { amount: '500', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.supplyInput).toBe('1000');
    expect(input.principalSupplyUsd).toBe(2000);
  });

  it('borrow with walletValue: delta and principal separated', () => {
    const reserveId = 'r-usdc';
    const reserve = makeRateCalcReserve({ reserveId, tokenPrice: 1 });
    const entries = [
      makeEntry({ reserveId, supply: { ...emptySide }, borrow: { amount: '800', inputMode: 'usd', walletValue: 500 } }),
    ];
    const result = buildPerReserveInputsFromEntries(entries, [reserve]);
    const input = result.get(reserveId)!;
    expect(input.borrowInput).toBe('300');
    expect(input.principalBorrowUsd).toBe(800);
  });
});

describe('simulatePortfolioPositions', () => {
  it('v3: borrow increases utilization b supply afterNative rises', () => {
    const reserve = makeRateCalcReserve();
    const basePositions = [
      makePosition({ side: 'supply', amount: '10000' }),
    ];
    const withBorrow = [
      makePosition({ side: 'supply', amount: '10000' }),
      makePosition({ side: 'borrow', amount: '5000' }),
    ];
    const baseArgs = baseSimArgs({ positions: basePositions, reserves: [reserve] });
    const coupledArgs = baseSimArgs({ positions: withBorrow, reserves: [reserve] });
    const baseResult = simulatePortfolioPositions(baseArgs);
    const coupledResult = simulatePortfolioPositions(coupledArgs);
    const baseSupply = baseResult.results.find((r) => r.side === 'supply')!;
    const coupledSupply = coupledResult.results.find((r) => r.side === 'supply')!;
    expect(coupledSupply.nativePercent).toBeGreaterThan(baseSupply.nativePercent);
  });

  it('v3: borrow increases utilization b borrow afterNative rises', () => {
    const reserve = makeRateCalcReserve();
    const smallBorrow = [
      makePosition({ side: 'borrow', amount: '1000' }),
    ];
    const largeBorrow = [
      makePosition({ side: 'borrow', amount: '10000' }),
    ];
    const smallArgs = baseSimArgs({ positions: smallBorrow, reserves: [reserve] });
    const largeArgs = baseSimArgs({ positions: largeBorrow, reserves: [reserve] });
    const smallResult = simulatePortfolioPositions(smallArgs);
    const largeResult = simulatePortfolioPositions(largeArgs);
    expect(largeResult.results[0].nativePercent).toBeGreaterThan(
      smallResult.results[0].nativePercent,
    );
  });

  it('v4 Hub: hubAggregationMap raises supply rate vs per-spoke baseline', () => {
    const reserve = makeRateCalcReserve({
      reserveId: 'r-usdc-v4',
      hubId: 'hub-usdc',
      hubName: 'usdc-hub',
      hubAddress: '0xHub',
    });
    const hubAggregationMap = new Map([
      [
        'hub-usdc:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        { hubBorrowed: '40000000000000', hubSupplied: '60000000000000' },
      ],
    ]);
    const positions = [
      makePosition({ reserveId: 'r-usdc-v4', side: 'supply', amount: '10000' }),
    ];
    const perSpokeArgs = baseSimArgs({ positions, reserves: [reserve] });
    const hubArgs = baseSimArgs({ positions, reserves: [reserve], hubAggregationMap });
    const perSpokeResult = simulatePortfolioPositions(perSpokeArgs);
    const hubResult = simulatePortfolioPositions(hubArgs);
    const perSpokeSupply = perSpokeResult.results.find((r) => r.side === 'supply')!;
    const hubSupply = hubResult.results.find((r) => r.side === 'supply')!;
    expect(hubSupply.nativePercent).toBeGreaterThan(perSpokeSupply.nativePercent);
  });

  it('fallback: reserve without rate calc fields uses baseline APY', () => {
    const reserve = {
      reserveId: 'r-no-calc',
      marketName: 'Test',
      chainName: 'Test',
      tokenSymbol: 'USDC',
      supplyApy: 3.0,
      borrowApy: 5.0,
      supplyIncentives: [0.5],
      borrowIncentives: [],
      tokenPrice: 1,
    } as ReserveWithSpread;
    const positions = [
      makePosition({
        reserveId: 'r-no-calc',
        side: 'supply',
        amount: '10000',
      }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toHaveLength(1);
    expect(results[0].nativePercent).toBe(3.0);
    expect(results[0].incentivePercent).toBe(0.5);
  });

  it('multiple reserves compute independently', () => {
    const usdcReserve = makeRateCalcReserve({
      reserveId: 'r-usdc',
      tokenSymbol: 'USDC',
      supplyApy: 2.5,
      borrowApy: 4.8,
    });
    const wethReserve = makeRateCalcReserve({
      reserveId: 'r-weth',
      tokenSymbol: 'WETH',
      tokenPrice: 3000,
      supplyApy: 1.2,
      borrowApy: 3.5,
    });
    const positions = [
      makePosition({
        reserveId: 'r-usdc',
        side: 'supply',
        amount: '10000',
      }),
      makePosition({
        reserveId: 'r-weth',
        side: 'borrow',
        amount: '5000',
      }),
    ];
    const args = baseSimArgs({
      positions,
      reserves: [usdcReserve, wethReserve],
    });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toHaveLength(2);
    const usdcResult = results.find((r) => r.reserveId === 'r-usdc');
    const wethResult = results.find((r) => r.reserveId === 'r-weth');
    expect(usdcResult).toBeDefined();
    expect(wethResult).toBeDefined();
    expect(usdcResult!.nativePercent).toBeGreaterThan(0);
    expect(wethResult!.nativePercent).toBeGreaterThan(0);
  });

  it('pure borrow without supply position', () => {
    const reserve = makeRateCalcReserve();
    const positions = [
      makePosition({
        side: 'borrow',
        amount: '5000',
      }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toHaveLength(1);
    expect(results[0].side).toBe('borrow');
    expect(results[0].nativePercent).toBeGreaterThan(0);
    expect(results[0].amountUsd).toBe(5000);
  });

  it('empty positions returns empty results', () => {
    const args = baseSimArgs({ positions: [], reserves: [makeRateCalcReserve()] });
    const { results, summary } = simulatePortfolioPositions(args);
    expect(results).toEqual([]);
    expect(summary.totalSupplyUsd).toBe(0);
    expect(summary.totalBorrowUsd).toBe(0);
  });

  it('skips positions with zero amount', () => {
    const reserve = makeRateCalcReserve();
    const positions = [
      makePosition({ side: 'supply', amount: '0' }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toEqual([]);
  });

  it('skips positions whose reserve is not found', () => {
    const reserve = makeRateCalcReserve({ reserveId: 'r-exists' });
    const positions = [
      makePosition({ reserveId: 'r-missing', side: 'supply', amount: '10000' }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toEqual([]);
  });

  it('skips hidden positions from results and summary', () => {
    const reserve = makeRateCalcReserve();
    const positions = [
      makePosition({ side: 'supply', amount: '10000', hidden: false }),
      makePosition({ side: 'supply', amount: '5000', hidden: true }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results, summary } = simulatePortfolioPositions(args);
    expect(results).toHaveLength(1);
    expect(summary.totalSupplyUsd).toBe(10000);
  });

  it('mixed hidden + visible positions: summary excludes hidden contribution', () => {
    const reserve = makeRateCalcReserve();
    const positions = [
      makePosition({ side: 'supply', amount: '10000', hidden: false }),
      makePosition({ side: 'borrow', amount: '3000', hidden: true }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results, summary } = simulatePortfolioPositions(args);
    expect(results).toHaveLength(1);
    expect(results[0].side).toBe('supply');
    expect(summary.totalBorrowUsd).toBe(0);
    expect(summary.totalSupplyUsd).toBe(10000);
  });

  describe('cross-reserve net position constraint', () => {
    it('equal supply+borrow across reserves b Merkl incentive fully offset', () => {
      const usdcReserveId = 'r-usdc-ink';
      const usdtReserveId = 'r-usdt-ink';
      const campaignId = 'merkl-campaign-1';
      const now = new Date();
      const farFuture = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
      const recentPast = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

      const usdcReserve = makeRateCalcReserve({
        reserveId: usdcReserveId,
        tokenSymbol: 'USDC',
        merklBorrows: [
          {
            breakdowns: [{ campaignId, campaignApr: 5, campaignStartedAt: recentPast, campaignEndedAt: farFuture }],
          },
        ],
      });

      const usdtReserve = makeRateCalcReserve({
        reserveId: usdtReserveId,
        tokenSymbol: 'USDT',
        merklSupplys: [
          {
            breakdowns: [{ campaignId: `${campaignId}-s`, campaignApr: 10, campaignStartedAt: recentPast, campaignEndedAt: farFuture }],
            netPositionConstraint: {
              sourceSide: 'supply',
              offsetReserveIds: [usdcReserveId],
            },
          },
        ],
      });

      const positions = [
        makePosition({
          reserveId: usdtReserveId,
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          reserveId: usdcReserveId,
          side: 'borrow',
          amount: '10000',
        }),
      ];

      const args = baseSimArgs({ positions, reserves: [usdtReserve, usdcReserve] });
      const { results } = simulatePortfolioPositions(args);

      const usdtSupply = results.find((r) => r.reserveId === usdtReserveId && r.side === 'supply');
      expect(usdtSupply).toBeDefined();
      expect(usdtSupply!.incentivePercent).toBe(0);
    });

    it('partial offset b Merkl incentive partially reduced', () => {
      const usdcReserveId = 'r-usdc-ink';
      const usdtReserveId = 'r-usdt-ink';
      const campaignId = 'merkl-campaign-2';
      const now = new Date();
      const farFuture = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
      const recentPast = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

      const usdcReserve = makeRateCalcReserve({
        reserveId: usdcReserveId,
        tokenSymbol: 'USDC',
      });

      const usdtReserve = makeRateCalcReserve({
        reserveId: usdtReserveId,
        tokenSymbol: 'USDT',
        merklSupplys: [
          {
            breakdowns: [{ campaignId, campaignApr: 10, campaignStartedAt: recentPast, campaignEndedAt: farFuture }],
            netPositionConstraint: {
              sourceSide: 'supply',
              offsetReserveIds: [usdcReserveId],
            },
          },
        ],
      });

      const noBorrowPositions = [
        makePosition({
          reserveId: usdtReserveId,
          side: 'supply',
          amount: '10000',
        }),
      ];
      const withBorrowPositions = [
        makePosition({
          reserveId: usdtReserveId,
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          reserveId: usdcReserveId,
          side: 'borrow',
          amount: '5000',
        }),
      ];

      const noBorrowArgs = baseSimArgs({ positions: noBorrowPositions, reserves: [usdtReserve, usdcReserve] });
      const withBorrowArgs = baseSimArgs({ positions: withBorrowPositions, reserves: [usdtReserve, usdcReserve] });

      const noBorrowResult = simulatePortfolioPositions(noBorrowArgs);
      const withBorrowResult = simulatePortfolioPositions(withBorrowArgs);

      const noBorrowSupply = noBorrowResult.results.find((r) => r.reserveId === usdtReserveId && r.side === 'supply')!;
      const withBorrowSupply = withBorrowResult.results.find((r) => r.reserveId === usdtReserveId && r.side === 'supply')!;

      expect(noBorrowSupply.incentivePercent).toBeGreaterThan(0);
      expect(withBorrowSupply.incentivePercent).toBeGreaterThan(0);
      expect(withBorrowSupply.incentivePercent).toBeLessThan(noBorrowSupply.incentivePercent);
    });

    it('no netPositionConstraint b Merkl incentive unaffected by cross-reserve borrow', () => {
      const usdcReserveId = 'r-usdc-ink';
      const usdtReserveId = 'r-usdt-ink';
      const campaignId = 'merkl-campaign-3';
      const now = new Date();
      const farFuture = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
      const recentPast = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

      const usdcReserve = makeRateCalcReserve({
        reserveId: usdcReserveId,
        tokenSymbol: 'USDC',
      });

      const usdtReserve = makeRateCalcReserve({
        reserveId: usdtReserveId,
        tokenSymbol: 'USDT',
        merklSupplys: [
          {
            breakdowns: [{ campaignId, campaignApr: 10, campaignStartedAt: recentPast, campaignEndedAt: farFuture }],
          },
        ],
      });

      const positions = [
        makePosition({
          reserveId: usdtReserveId,
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          reserveId: usdcReserveId,
          side: 'borrow',
          amount: '10000',
        }),
      ];

      const args = baseSimArgs({ positions, reserves: [usdtReserve, usdcReserve] });
      const { results } = simulatePortfolioPositions(args);

      const usdtSupply = results.find((r) => r.reserveId === usdtReserveId && r.side === 'supply')!;
      expect(usdtSupply.incentivePercent).toBeGreaterThan(0);
    });
  });
});

describe('simulatePortfolioFromEntries', () => {
  it('computes results from entries with supply and borrow', () => {
    const reserve = makeRateCalcReserve();
    const entries = [
      makeEntry({ supply: { amount: '10000', inputMode: 'usd', walletValue: null }, borrow: { amount: '5000', inputMode: 'usd', walletValue: null } }),
    ];
    const args = baseEntriesSimArgs({ entries, reserves: [reserve] });
    const { results, summary } = simulatePortfolioFromEntries(args);
    expect(results.length).toBeGreaterThan(0);
    expect(summary.totalSupplyUsd).toBeGreaterThan(0);
    expect(summary.totalBorrowUsd).toBeGreaterThan(0);
  });

  it('empty entries returns empty results', () => {
    const args = baseEntriesSimArgs({ entries: [], reserves: [makeRateCalcReserve()] });
    const { results, summary } = simulatePortfolioFromEntries(args);
    expect(results).toEqual([]);
    expect(summary.totalSupplyUsd).toBe(0);
    expect(summary.totalBorrowUsd).toBe(0);
  });

  it('skips hidden entries', () => {
    const reserve = makeRateCalcReserve();
    const entries = [
      makeEntry({ hidden: true, supply: { amount: '10000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const args = baseEntriesSimArgs({ entries, reserves: [reserve] });
    const { results } = simulatePortfolioFromEntries(args);
    expect(results).toEqual([]);
  });

  it('skips orphan entries', () => {
    const reserve = makeRateCalcReserve();
    const entries = [
      makeEntry({ isOrphan: true, supply: { amount: '10000', inputMode: 'usd', walletValue: null }, borrow: { ...emptySide } }),
    ];
    const args = baseEntriesSimArgs({ entries, reserves: [reserve] });
    const { results } = simulatePortfolioFromEntries(args);
    expect(results).toEqual([]);
  });
});

const makeLane = (overrides: Partial<SimulationLane> = {}): SimulationLane => ({
  hasInput: true,
  inputAmount: 10000,
  inputUsd: 10000,
  currentNative: 2.8,
  currentIncentive: 0.9,
  currentTotal: 3.7,
  afterNative: 3.0,
  afterIncentive: 1.0,
  afterTotal: 4.0,
  deltaNative: 0.2,
  deltaIncentive: 0.1,
  deltaTotal: 0.3,
  sources: {
    protocol: { current: 0, after: 0, delta: 0 },
    merit: { current: 0, after: 0, delta: 0 },
    merkl: { current: 0, after: 0, delta: 0 },
    brevis: { current: 0, after: 0, delta: 0 },
  },
  ...overrides,
});

describe('buildMetricsFromLane', () => {
  it('extracts native/incentive/total metrics from lane', () => {
    const lane = makeLane();
    const metrics = buildMetricsFromLane(lane, 'supply', 10000);
    expect(metrics.nativeMetric).toEqual({ current: 2.8, after: 3.0, delta: 0.2 });
    expect(metrics.incentiveMetric).toEqual({ current: 0.9, after: 1.0, delta: 0.1 });
    expect(metrics.totalMetric).toEqual({ current: 3.7, after: 4.0, delta: 0.3 });
  });

  it('computes usdPerDayMetric from current and after rates', () => {
    const lane = makeLane();
    const metrics = buildMetricsFromLane(lane, 'supply', 10000);
    expect(metrics.usdPerDayMetric).toBeDefined();
    expect(metrics.usdPerDayMetric!.current).toBeCloseTo(
      (10000 * 2.8 / 100 / 365) + (10000 * 0.9 / 100 / 365),
      6,
    );
    expect(metrics.usdPerDayMetric!.after).toBeCloseTo(
      (10000 * 3.0 / 100 / 365) + (10000 * 1.0 / 100 / 365),
      6,
    );
    expect(metrics.usdPerDayMetric!.delta).toBeCloseTo(
      metrics.usdPerDayMetric!.after - metrics.usdPerDayMetric!.current,
      6,
    );
  });

  it('computes borrow usdPerDayMetric with correct sign', () => {
    const lane = makeLane({ currentNative: 5, afterNative: 6, deltaNative: 1, currentIncentive: 0.5, afterIncentive: 0.6, deltaIncentive: 0.1 });
    const metrics = buildMetricsFromLane(lane, 'borrow', 10000);
    expect(metrics.usdPerDayMetric!.current).toBeCloseTo(
      -(10000 * 5 / 100 / 365) + (10000 * 0.5 / 100 / 365),
      6,
    );
    expect(metrics.usdPerDayMetric!.after).toBeCloseTo(
      -(10000 * 6 / 100 / 365) + (10000 * 0.6 / 100 / 365),
      6,
    );
  });

  it('handles null native rates in usdPerDayMetric', () => {
    const lane = makeLane({ currentNative: null, afterNative: null, deltaNative: null });
    const metrics = buildMetricsFromLane(lane, 'supply', 10000);
    expect(metrics.nativeMetric!.current).toBeNull();
    expect(metrics.usdPerDayMetric).toBeDefined();
  });
});
