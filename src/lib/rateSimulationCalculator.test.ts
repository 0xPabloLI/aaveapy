import { describe, expect, it } from 'vitest';
import { buildRateSimulationResult } from './rateSimulationCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import type { ReserveWithSpread } from '@/types/aave';

const BASE_RESERVE: ReserveWithSpread = {
  reserveId: 'Core-0xTEST',
  marketName: 'Core',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USDC',
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  aTokenAddress: '0x0000000000000000000000000000000000000002',
  vTokenAddress: '0x0000000000000000000000000000000000000003',
  supplyApy: 3.0,
  borrowApy: 5.0,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
  liquidity: '5000000000000000000000',
  utilizationPct: 45,
  optimalUtilization: 80,
  decimals: 18,
  supplied: '10000000000000000000000',
  borrowed: '4500000000000000000000',
  tokenPrice: 1,
  protocolFee: 15,
  supplyCap: '20000000000000000000000',
  borrowCap: '15000000000000000000000',
};

const VALID_RATE_INPUT: RateCalcInput = {
  decimals: 18,
  deficit: '0',
  liquidity: '5000000000000000000000',
  borrowed: '4500000000000000000000',
  protocolFee: 15,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  optimalUtilization: 80,
};

const BASE_PARAMS = {
  isApy: false,
  whitelistMerklCampaignIds: new Set<string>(),
  tydroPointToUsdRate: 1,
  tokenPrice: 1,
  supplyInput: '',
  borrowInput: '',
  forecastStates: {} as Record<string, never>,
};

describe('A/B category: A-class fields (current snapshot)', () => {
  it('A-class fields have values when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: null,
      ...BASE_PARAMS,
    });

    expect(result.utilization.current).toBe(45);
    expect(result.utilization.optimal).toBe(80);
    expect(result.marketMetrics.protocolFee).toBe(15);
    expect(result.marketMetrics.optimalUtilization).toBe(80);
    expect(result.supply.currentNative).toBeDefined();
    expect(result.borrow.currentNative).toBeDefined();
    expect(result.spread.current).toBeDefined();
  });

  it('A-class fields are unchanged when simulation input is provided', () => {
    const noInput = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withInput = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(withInput.utilization.current).toBe(noInput.utilization.current);
    expect(withInput.utilization.optimal).toBe(noInput.utilization.optimal);
    expect(withInput.marketMetrics.protocolFee).toBe(noInput.marketMetrics.protocolFee);
    expect(withInput.marketMetrics.optimalUtilization).toBe(noInput.marketMetrics.optimalUtilization);
    expect(withInput.supply.currentNative).toBe(noInput.supply.currentNative);
    expect(withInput.borrow.currentNative).toBe(noInput.borrow.currentNative);
    expect(withInput.spread.current).toBe(noInput.spread.current);
  });

  it('A-class marketMetrics fields are stable across input changes', () => {
    const noInput = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withBorrow = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(withBorrow.marketMetrics.totalBorrowedUsd).toBe(noInput.marketMetrics.totalBorrowedUsd);
    expect(withBorrow.marketMetrics.availableLiquidityUsd).toBe(noInput.marketMetrics.availableLiquidityUsd);
    expect(withBorrow.marketMetrics.supplyCapUsd).toBe(noInput.marketMetrics.supplyCapUsd);
    expect(withBorrow.marketMetrics.borrowCapUsd).toBe(noInput.marketMetrics.borrowCapUsd);
  });
});

describe('A/B category: B-class fields (after/delta)', () => {
  it('B-class fields are null when no simulation input', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    expect(result.supply.afterNative).toBeNull();
    expect(result.supply.deltaNative).toBeNull();
    expect(result.borrow.afterNative).toBeNull();
    expect(result.borrow.deltaNative).toBeNull();
    expect(result.spread.after).toBeNull();
    expect(result.spread.delta).toBeNull();
    expect(result.utilization.after).toBeNull();
    expect(result.marketMetrics.availableLiquidityUsdAfter).toBeNull();
    expect(result.marketMetrics.availableLiquidityUsdDelta).toBeNull();
    expect(result.marketMetrics.totalBorrowedUsdAfter).toBeNull();
    expect(result.marketMetrics.totalBorrowedUsdDelta).toBeNull();
    expect(result.scenarioUsdAccrual).toBeNull();
  });

  it('B-class fields have values when supply input is provided', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.supply.afterNative).not.toBeNull();
    expect(result.borrow.afterNative).not.toBeNull();
    expect(result.utilization.after).not.toBeNull();
    expect(result.marketMetrics.availableLiquidityUsdAfter).not.toBeNull();
  });

  it('B-class fields have values when borrow input is provided', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(result.supply.afterNative).not.toBeNull();
    expect(result.borrow.afterNative).not.toBeNull();
    expect(result.utilization.after).not.toBeNull();
    expect(result.marketMetrics.totalBorrowedUsdAfter).not.toBeNull();
  });

  it('B-class fields are null in fallback path (reserveRateInput null, no input)', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: null,
      ...BASE_PARAMS,
    });

    expect(result.supply.afterNative).toBeNull();
    expect(result.borrow.afterNative).toBeNull();
    expect(result.spread.after).toBeNull();
    expect(result.utilization.after).toBeNull();
    expect(result.marketMetrics.availableLiquidityUsdAfter).toBeNull();
    expect(result.marketMetrics.totalBorrowedUsdAfter).toBeNull();
    expect(result.scenarioUsdAccrual).toBeNull();
  });
});

describe('A/B category: fallback behavior', () => {
  it('uses reserve.utilizationPct as A-class fallback when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: null,
      ...BASE_PARAMS,
    });

    expect(result.utilization.current).toBe(45);
  });

  it('uses reserve.optimalUtilization as A-class fallback when reserveRateInput is null', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: null,
      ...BASE_PARAMS,
    });

    expect(result.utilization.optimal).toBe(80);
  });

  it('uses reserve.protocolFee as A-class fallback when reserveRateInput.protocolFee is NaN', () => {
    const inputWithNaNFee: RateCalcInput = {
      ...VALID_RATE_INPUT,
      protocolFee: NaN,
    };
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: inputWithNaNFee,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.marketMetrics.protocolFee).toBe(15);
  });
});

describe('A/B category: availableBorrowRoomUsd boundary', () => {
  it('borrow input alone does not change availableBorrowRoomUsd', () => {
    const noInput = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withBorrow = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(withBorrow.marketMetrics.availableBorrowRoomUsd)
      .toBe(noInput.marketMetrics.availableBorrowRoomUsd);
  });

  it('supply input changes availableBorrowRoomUsd (A→B hybrid via availableLiquidityForBorrow)', () => {
    const noInput = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withSupply = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(withSupply.marketMetrics.availableBorrowRoomUsd)
      .toBeGreaterThan(noInput.marketMetrics.availableBorrowRoomUsd!);
  });
});

describe('principalSupplyUsd / principalBorrowUsd', () => {
  it('defaults to supplyInputUsd when principalSupplyUsd is omitted', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withPrincipalExplicit = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      principalSupplyUsd: 1000,
    });
    expect(withPrincipalExplicit.scenarioUsdAccrual?.supply.totalUsdPerDay)
      .toBe(withoutPrincipal.scenarioUsdAccrual?.supply.totalUsdPerDay);
  });

  it('uses principalSupplyUsd for accrual instead of supplyInputUsd', () => {
    const base = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withLargerPrincipal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      principalSupplyUsd: 2000,
    });
    expect(withLargerPrincipal.scenarioUsdAccrual?.supply.totalUsdPerDay)
      .toBeGreaterThan(base.scenarioUsdAccrual?.supply.totalUsdPerDay ?? 0);
  });

  it('uses principalBorrowUsd for accrual instead of borrowInputUsd', () => {
    const base = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });
    const withLargerBorrowPrincipal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
      principalBorrowUsd: 1000,
    });
    expect(
      Math.abs(
        withLargerBorrowPrincipal.scenarioUsdAccrual?.borrow.totalUsdPerDay ?? 0
      ),
    ).toBeGreaterThan(
      Math.abs(base.scenarioUsdAccrual?.borrow.totalUsdPerDay ?? 0),
    );
  });

  it('does not affect rate simulation (after rates) when only principal differs', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      principalSupplyUsd: 5000,
    });
    expect(withPrincipal.supply.afterNative)
      .toBe(withoutPrincipal.supply.afterNative);
    expect(withPrincipal.supply.afterTotal)
      .toBe(withoutPrincipal.supply.afterTotal);
  });
});

const MERIT_SELF_CAP_RESERVE: ReserveWithSpread = {
  ...BASE_RESERVE,
  meritSupplys: [
    {
      apr: 10,
      selfApr: 8,
      selfMessage: 'Self authentication. Cap: $1,000',
      link: 'https://example.com',
      name: 'Merit Test',
      message: [{ description: 'Base reward' }, { description: 'Self authentication. Cap: $1,000' }],
      startDate: '2024-01-01',
      endDate: '2030-12-31',
      lastRoundRewardUsd: 100,
    },
  ],
  meritBorrows: [
    {
      apr: 5,
      selfApr: 4,
      selfMessage: 'Self authentication. Cap: $500',
      link: 'https://example.com',
      name: 'Merit Borrow Test',
      message: [{ description: 'Base reward' }, { description: 'Self authentication. Cap: $500' }],
      startDate: '2024-01-01',
      endDate: '2030-12-31',
      lastRoundRewardUsd: 50,
    },
  ],
};

describe('Bug 2-4: merit self-cap totalPositionUsd in campaign details & after sources', () => {
  it('Bug 2: campaign detail self-cap after should be diluted when principalSupplyUsd exists', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      principalSupplyUsd: 1000,
    });

    const noPrincipalCampaigns = withoutPrincipal.supply.sources.merit?.campaigns ?? [];
    const withPrincipalCampaigns = withPrincipal.supply.sources.merit?.campaigns ?? [];

    const selfCapRowNoPrincipal = noPrincipalCampaigns.find((r) => r.id.includes('self'));
    const selfCapRowWithPrincipal = withPrincipalCampaigns.find((r) => r.id.includes('self'));

    expect(selfCapRowNoPrincipal?.after).not.toBeNull();
    expect(selfCapRowWithPrincipal?.after).not.toBeNull();

    // With principalSupplyUsd=1000 + input=1000, totalPosition=2000, cap=1000
    // dilution = 1000/2000 = 0.5, so self-cap after should be half of no-principal case
    expect(selfCapRowWithPrincipal!.after!).toBeLessThan(selfCapRowNoPrincipal!.after!);
  });

  it('Bug 3: supply after sources merit should reflect self-cap dilution with principalSupplyUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      principalSupplyUsd: 1000,
    });

    // When principalSupplyUsd is provided, self-cap dilution reduces merit after
    // so the aggregate merit after value should also decrease
    expect(withPrincipal.supply.sources.merit!.after)
      .toBeLessThan(withoutPrincipal.supply.sources.merit!.after);
  });

  it('Bug 4: borrow after sources merit should reflect self-cap dilution with principalBorrowUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
      principalBorrowUsd: 500,
    });

    // Same logic as Bug 3 but for borrow side
    expect(withPrincipal.borrow.sources.merit!.after)
      .toBeLessThan(withoutPrincipal.borrow.sources.merit!.after);
  });
});
