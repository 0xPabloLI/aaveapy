import { describe, it, expect } from 'vitest';
import type { ReserveWithSpread } from '@/types/aave';
import type { PortfolioPosition } from '@/types/portfolio';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { simulatePortfolioPositions } from './portfolioSimulator';
import type { SimulatePortfolioPositionsArgs } from './portfolioSimulator';

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

const makePosition = (
  overrides: Partial<PortfolioPosition> = {},
): PortfolioPosition => ({
  positionId: 'p-1',
  reserveId: 'r-usdc-v3',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'USDC',
  side: 'supply',
  amount: '10000',
  inputMode: 'usd',
  walletValue: null,
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

describe('simulatePortfolioPositions', () => {
  it('v3: borrow increases utilization → supply afterNative rises', () => {
    const reserve = makeRateCalcReserve();
    const basePositions = [
      makePosition({ positionId: 'p-sup', side: 'supply', amount: '10000' }),
    ];
    const withBorrow = [
      makePosition({ positionId: 'p-sup', side: 'supply', amount: '10000' }),
      makePosition({ positionId: 'p-bor', side: 'borrow', amount: '5000' }),
    ];
    const baseArgs = baseSimArgs({ positions: basePositions, reserves: [reserve] });
    const coupledArgs = baseSimArgs({ positions: withBorrow, reserves: [reserve] });
    const baseResult = simulatePortfolioPositions(baseArgs);
    const coupledResult = simulatePortfolioPositions(coupledArgs);
    const baseSupply = baseResult.results.find((r) => r.side === 'supply')!;
    const coupledSupply = coupledResult.results.find((r) => r.side === 'supply')!;
    expect(coupledSupply.nativePercent).toBeGreaterThan(baseSupply.nativePercent);
  });

  it('v3: borrow increases utilization → borrow afterNative rises', () => {
    const reserve = makeRateCalcReserve();
    const smallBorrow = [
      makePosition({ positionId: 'p-bor', side: 'borrow', amount: '1000' }),
    ];
    const largeBorrow = [
      makePosition({ positionId: 'p-bor', side: 'borrow', amount: '10000' }),
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
      makePosition({ positionId: 'p-sup', reserveId: 'r-usdc-v4', side: 'supply', amount: '10000' }),
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
        positionId: 'p-sup',
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
        positionId: 'p-usdc-sup',
        reserveId: 'r-usdc',
        side: 'supply',
        amount: '10000',
      }),
      makePosition({
        positionId: 'p-weth-bor',
        reserveId: 'r-weth',
        side: 'borrow',
        amount: '5000',
        tokenSymbol: 'WETH',
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
        positionId: 'p-bor',
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
      makePosition({ positionId: 'p-zero', side: 'supply', amount: '0' }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toEqual([]);
  });

  it('skips positions whose reserve is not found', () => {
    const reserve = makeRateCalcReserve({ reserveId: 'r-exists' });
    const positions = [
      makePosition({ positionId: 'p-missing', reserveId: 'r-missing', side: 'supply', amount: '10000' }),
    ];
    const args = baseSimArgs({ positions, reserves: [reserve] });
    const { results } = simulatePortfolioPositions(args);
    expect(results).toEqual([]);
  });

  describe('cross-reserve net position constraint', () => {
    it('equal supply+borrow across reserves → Merkl incentive fully offset', () => {
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
          positionId: 'p-usdt-sup',
          reserveId: usdtReserveId,
          tokenSymbol: 'USDT',
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          positionId: 'p-usdc-bor',
          reserveId: usdcReserveId,
          tokenSymbol: 'USDC',
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

    it('partial offset → Merkl incentive partially reduced', () => {
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
          positionId: 'p-usdt-sup',
          reserveId: usdtReserveId,
          tokenSymbol: 'USDT',
          side: 'supply',
          amount: '10000',
        }),
      ];
      const withBorrowPositions = [
        makePosition({
          positionId: 'p-usdt-sup',
          reserveId: usdtReserveId,
          tokenSymbol: 'USDT',
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          positionId: 'p-usdc-bor',
          reserveId: usdcReserveId,
          tokenSymbol: 'USDC',
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

    it('no netPositionConstraint → Merkl incentive unaffected by cross-reserve borrow', () => {
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
          positionId: 'p-usdt-sup',
          reserveId: usdtReserveId,
          tokenSymbol: 'USDT',
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          positionId: 'p-usdc-bor',
          reserveId: usdcReserveId,
          tokenSymbol: 'USDC',
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
