import { describe, expect, it } from 'vitest';
import { buildRateSimulationResult } from './rateSimulationCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import type { ReserveWithSpread } from '@/types/aave';

const BASE_RESERVE: ReserveWithSpread = {
  reserveId: '1:0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  marketName: 'Core',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USDC',
  tokenSymbol: 'USDC',
  tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  aTokenAddress: '0x23878914efe38d27c4d67ab83ed1b93a74fc4075',
  vTokenAddress: '0x625e7708f30ca75bfd92586e17077590c60eb4cd',
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

describe('totalSupplyUsd / totalBorrowUsd', () => {
  it('defaults to supplyInputUsd when totalSupplyUsd is omitted', () => {
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
      totalSupplyUsd: 1000,
    });
    expect(withPrincipalExplicit.scenarioUsdAccrual?.supply.totalUsdPerDay)
      .toBe(withoutPrincipal.scenarioUsdAccrual?.supply.totalUsdPerDay);
  });

  it('uses totalSupplyUsd for accrual instead of supplyInputUsd', () => {
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
      totalSupplyUsd: 2000,
    });
    expect(withLargerPrincipal.scenarioUsdAccrual?.supply.totalUsdPerDay)
      .toBeGreaterThan(base.scenarioUsdAccrual?.supply.totalUsdPerDay ?? 0);
  });

  it('uses totalBorrowUsd for accrual instead of borrowInputUsd', () => {
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
      totalBorrowUsd: 1000,
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
      totalSupplyUsd: 5000,
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
  it('Bug 2: campaign detail self-cap after should be diluted when total position exceeds cap', () => {
    // Without principal: depositUsd=500, positionForCap=500, cap=1000 → no dilution
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });
    // With principal: totalPositionUsd=1500, depositUsd=500, cap=1000
    // eligible=min(1500,1000)=1000, dilution=1000/1500 ≈ 0.67
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 1500, // wallet=$1000 + delta=$500 → total=$1500 > cap=$1000
    });

    const noPrincipalCampaigns = withoutPrincipal.supply.sources.merit?.campaigns ?? [];
    const withPrincipalCampaigns = withPrincipal.supply.sources.merit?.campaigns ?? [];

    const selfCapRowNoPrincipal = noPrincipalCampaigns.find((r) => r.id.includes('self'));
    const selfCapRowWithPrincipal = withPrincipalCampaigns.find((r) => r.id.includes('self'));

    expect(selfCapRowNoPrincipal?.after).not.toBeNull();
    expect(selfCapRowWithPrincipal?.after).not.toBeNull();

    // With principal=$1500 > cap=$1000, self-cap should be diluted
    expect(selfCapRowWithPrincipal!.after!).toBeLessThan(selfCapRowNoPrincipal!.after!);
  });

  it('Bug 3: supply after sources merit should reflect self-cap dilution with totalSupplyUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 1500,
    });

    // When total position (principal=$1500) exceeds cap ($1000), dilution reduces merit after
    expect(withPrincipal.supply.sources.merit!.after)
      .toBeLessThan(withoutPrincipal.supply.sources.merit!.after);
  });

  it('Bug AAV-761: supply incentive campaign detail after=null (not 0) when only borrow has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    const campaigns = result.supply.sources.merit?.campaigns ?? [];
    const baseRow = campaigns.find((r) => r.id.includes('base'));
    const selfRow = campaigns.find((r) => r.id.includes('self'));

    expect(baseRow?.after).toBeNull();
    expect(selfRow?.after).toBeNull();
  });

  it('Bug AAV-761: merkl supply campaign detail after=null (not 0) when only borrow has input', () => {
    const merklReserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      merklSupplys: [{
        name: 'Merkl Supply',
        breakdowns: [{
          campaignApr: 2.5,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2027-12-31',
          campaignId: 'merkl-supply-1',
        }],
      }],
    };
    const result = buildRateSimulationResult({
      reserve: merklReserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    const campaigns = result.supply.sources.merkl?.campaigns ?? [];
    const row = campaigns[0];
    expect(row?.after).toBeNull();
  });

  it('Bug AAV-761: borrow incentive campaign detail after=null (not 0) when only supply has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    const campaigns = result.borrow.sources.merit?.campaigns ?? [];
    const baseRow = campaigns.find((r) => r.id.includes('base'));
    const selfRow = campaigns.find((r) => r.id.includes('self'));

    expect(baseRow?.after).toBeNull();
    expect(selfRow?.after).toBeNull();
  });

  it('AAV-771: brevis supply campaign detail after=null when only borrow has input (explicit hasAnyInput guard)', () => {
    const brevisReserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      brevisSupplys: [{
        campaignApr: 5,
        link: 'https://example.com/brevis',
        campaignStartedAt: '2024-01-01',
        campaignEndedAt: '2030-12-31',
        campaignId: 'brevis-supply-1',
        message: 'Brevis Supply',
      }],
    };
    const result = buildRateSimulationResult({
      reserve: brevisReserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    const campaigns = result.supply.sources.brevis?.campaigns ?? [];
    const row = campaigns[0];
    expect(row?.after).toBeNull();
  });

  it('AAV-770 regression fix: supply.sources.*.after is not null when only borrow has input (cross-side preservation)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(result.supply.sources.merit?.after).not.toBeNull();
    expect(result.supply.sources.merkl?.after).not.toBeNull();
    expect(result.supply.sources.protocol?.after).not.toBeNull();
  });

  it('AAV-770 regression fix: borrow.sources.*.after is not null when only supply has input (cross-side preservation)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.borrow.sources.merit?.after).not.toBeNull();
    expect(result.borrow.sources.merkl?.after).not.toBeNull();
    expect(result.borrow.sources.protocol?.after).not.toBeNull();
  });

  it('AAV-770 regression fix: supply.afterIncentive is null when only borrow has input (no false-zero)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    // Per-side guard: no supply input → afterIncentive is null (not 0), UI falls back to current
    expect(result.supply.afterIncentive).toBeNull();
    expect(result.supply.deltaIncentive).toBeNull();
    // Native rate still preserves cross-side influence (utilization change)
    expect(result.supply.afterNative).not.toBeNull();
  });

  it('AAV-770 regression fix: borrow.afterIncentive is null when only supply has input (no false-zero)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    // Per-side guard: no borrow input → afterIncentive is null (not 0), UI falls back to current
    expect(result.borrow.afterIncentive).toBeNull();
    expect(result.borrow.deltaIncentive).toBeNull();
    expect(result.borrow.afterNative).not.toBeNull();
  });

  it('cross-side: supply.afterNative is not null when only borrow has input (no supply change)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    // Native rate still preserves cross-side influence (utilization change from borrow input)
    expect(result.supply.afterNative).not.toBeNull();
    // Incentive and total are null when no supply input
    expect(result.supply.afterIncentive).toBeNull();
    expect(result.supply.afterTotal).toBeNull();
    expect(result.supply.deltaNative).toBeNull();
    expect(result.supply.deltaTotal).toBeNull();
  });

  it('cross-side: borrow.afterNative is not null when only supply has input (cross-side influence preserved)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    // Native rate still preserves cross-side influence (utilization change from supply input)
    expect(result.borrow.afterNative).not.toBeNull();
    // Incentive and total are null when no borrow input
    expect(result.borrow.afterIncentive).toBeNull();
    expect(result.borrow.afterTotal).toBeNull();
    expect(result.borrow.deltaNative).toBeNull();
    expect(result.borrow.deltaTotal).toBeNull();
  });

  it('AAV-761 layer-3: supply delta is null when only borrow has input (hasInput=false side)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.deltaNative).toBeNull();
    expect(result.supply.deltaIncentive).toBeNull();
    expect(result.supply.deltaTotal).toBeNull();
  });

  it('AAV-761 layer-3: borrow delta is null when only supply has input (hasInput=false side)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.borrow.hasInput).toBe(false);
    expect(result.borrow.deltaNative).toBeNull();
    expect(result.borrow.deltaIncentive).toBeNull();
    expect(result.borrow.deltaTotal).toBeNull();
  });

  it('single simulation: self-cap should NOT double-count when supplyInput used alone (no principal)', () => {
    // In single simulation mode, crossReservePositions stores the shared simulation input,
    // not a wallet position. totalSupplyUsd should NOT be passed.
    // This test guards against the regression where totalSupplyUsd = supplyInput
    // caused totalPositionUsd = 2× input (double-count) in merit self-cap dilution.
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      // NO totalSupplyUsd — correct for single simulation (no wallet position)
    });

    const campaigns = result.supply.sources.merit?.campaigns ?? [];
    const selfCapRow = campaigns.find((r) => r.id.includes('self'));
    const baseRow = campaigns.find((r) => r.id.includes('base'));

    expect(selfCapRow?.after).not.toBeNull();
    expect(baseRow?.after).not.toBeNull();

    // depositUsd=500, selfCap=1000, positionForCap=500, eligible=min(500,1000)=500
    // dilution = 500/500 = 1 → full self APR, no extra dilution from phantom wallet
    // Both self-cap and base should have valid, non-zero after values
    expect(selfCapRow!.after!).toBeGreaterThan(0);
    expect(baseRow!.after!).toBeGreaterThan(0);

    // Verify the total incentive after is correct (supply.sources.merit.after)
    expect(result.supply.sources.merit?.after).not.toBeNull();
    expect(result.supply.sources.merit!.after).toBeGreaterThan(0);
  });

  it('portfolio: totalSupplyUsd > supplyInput should NOT double-count (wallet + delta scenario)', () => {
    // This test verifies the fix: totalSupplyUsd already includes delta,
    // so totalPositionUsd = totalSupplyUsd (NOT principal + netInput).
    //
    // Scenario: wallet=$500, delta=$500 → effective=$1000
    // totalSupplyUsd=1000, supplyInput=500
    // Old (buggy): totalPosition = 1000+500 = 1500 (double-count)
    // New (fixed): totalPosition = 1000
    //
    // With self-cap=$200: totalPosition=1000, eligible=min(1000,200)=200, dilution=200/1000=0.2
    // This is MORE diluted than without principal (position=500, dilution=200/500=0.4)
    const SMALL_CAP_RESERVE: ReserveWithSpread = {
      ...BASE_RESERVE,
      meritSupplys: [{
        apr: 10, selfApr: 8,
        selfMessage: 'Self authentication. Cap: $200',
        link: 'https://example.com', name: 'Small Cap Test',
        message: [{ description: 'Base' }, { description: 'Self authentication. Cap: $200' }],
        startDate: '2024-01-01', endDate: '2030-12-31',
        lastRoundRewardUsd: 100,
      }],
    };

    // delta=$500, no wallet → totalPosition=500, eligible=min(500,200)=200, dilution=200/500=0.4
    const noWallet = buildRateSimulationResult({
      reserve: SMALL_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });
    // wallet=$500 + delta=$500 → principal=$1000, totalPosition=1000, eligible=min(1000,200)=200, dilution=200/1000=0.2
    const withWallet = buildRateSimulationResult({
      reserve: SMALL_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 1000, // wallet=$500 + delta=$500 = effective=$1000
    });

    const noWalletSelf = (noWallet.supply.sources.merit?.campaigns ?? [])
      .find((r) => r.id.includes('self'));
    const withWalletSelf = (withWallet.supply.sources.merit?.campaigns ?? [])
      .find((r) => r.id.includes('self'));

    expect(noWalletSelf?.after).not.toBeNull();
    expect(withWalletSelf?.after).not.toBeNull();
    // With wallet, total position ($1000) > cap ($200), more dilution → lower after
    expect(withWalletSelf!.after!).toBeLessThan(noWalletSelf!.after!);
  });

  it('Bug 4: borrow after sources merit should reflect self-cap dilution with totalBorrowUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '300',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '300',
      totalBorrowUsd: 800, // wallet=$500 + delta=$300 → total=$800 > cap=$500
    });

    // With total position $800 > cap $500, self-cap should be diluted
    expect(withPrincipal.borrow.sources.merit!.after)
      .toBeLessThan(withoutPrincipal.borrow.sources.merit!.after);
  });
});

describe('self-cap dilution: buildIncentiveCurrent with wallet position', () => {
  // Fixture: MERIT_SELF_CAP_RESERVE has supply self-cap = $1,000 (from selfMessage)
  it('current incentive should be diluted when wallet position exceeds self-cap', () => {
    // Wallet=$1500 > self-cap=$1000 → dilution ratio = 1000/1500 ≈ 0.667
    // current incentive (with wallet) should be LOWER than undiluted headline rate
    const noWallet = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    // With wallet position that exceeds cap
    const withWallet = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
    });

    // current incentive WITH wallet should be LOWER than undiluted (wallet exceeds cap)
    expect(withWallet.supply.currentIncentive)
      .toBeLessThan(noWallet.supply.currentIncentive);
  });

  it('current incentive delta should reflect only the delta change, not wallet dilution artifact', () => {
    // Wallet=$1500, delta=$500, self-cap=$1000
    // current = diluted(wallet=1500) → ratio = 1000/1500 ≈ 0.667
    // after = diluted(wallet+delta=2000) → ratio = 1000/2000 = 0.5
    // delta = after - current (should be the actual impact of adding $500)
    const withWalletAndDelta = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      walletSupplyUsd: 1500,
      totalSupplyUsd: 2000,
    });

    // With wallet=1500 > cap=1000, current should already be diluted
    expect(withWalletAndDelta.supply.currentIncentive)
      .toBeLessThan(18); // 10 (base) + 8 (self) = 18 undiluted

    // delta should be negative (adding position further dilutes self-cap)
    const deltaIncentive = withWalletAndDelta.supply.deltaIncentive!;
    expect(deltaIncentive).toBeLessThan(0);
    expect(deltaIncentive).toBeGreaterThan(-3); // small negative, not a huge jump
  });

  it('portfolio: current and after should both be diluted when wallet exceeds cap', () => {
    // Simulates portfolio mode: wallet=1500, delta=500, cap=1000
    // Both current (wallet only) and after (wallet+delta) should be diluted
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      walletSupplyUsd: 1500,
      totalSupplyUsd: 2000,
    });

    const currentIncentive = result.supply.currentIncentive;
    const afterIncentive = result.supply.afterIncentive!;

    // Both should be diluted (cap=$1000)
    // current dilution: min(1500, 1000) / 1500 = 1000/1500 ≈ 0.667
    // after dilution: min(2000, 1000) / 2000 = 1000/2000 = 0.5
    expect(currentIncentive).toBeLessThan(18);
    expect(afterIncentive).toBeLessThan(currentIncentive);
    expect(afterIncentive).toBeGreaterThan(0);
  });

  it('single simulation: current incentive should NOT be diluted (no wallet)', () => {
    // Single simulation has no wallet position, so current incentive should be undiluted
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      // NO walletSupplyUsd, NO totalSupplyUsd — single simulation
    });

    // currentIncentive should be the undiluted headline rate (10 + 8 = 18)
    // With self-cap $1000 and no wallet, there's nothing to dilute
    expect(result.supply.currentIncentive).toBeGreaterThanOrEqual(17);
  });
});

describe('deltaIncentive shows dilution gap when hasInput=false but wallet exists', () => {
  it('deltaIncentive is null when no wallet position (no dilution)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      // No supplyInput, no wallet — delta should be null
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.deltaIncentive).toBeNull();
  });

  it('deltaIncentive = currentIncentive - headlineIncentive when wallet exceeds cap', () => {
    // Wallet=$1500 > self-cap=$1000 → current is diluted
    // deltaIncentive should show the dilution gap (negative value)
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
      // No supplyInput → hasInput=false
    });

    expect(result.supply.hasInput).toBe(false);
    // deltaIncentive should NOT be null — it should show the dilution gap
    expect(result.supply.deltaIncentive).not.toBeNull();
    // deltaIncentive should be negative (current < headline due to dilution)
    expect(result.supply.deltaIncentive!).toBeLessThan(0);
    // deltaIncentive = currentIncentive - headlineIncentive
    expect(result.supply.deltaIncentive).toBeCloseTo(
      result.supply.currentIncentive - result.supply.headlineIncentive,
      4,
    );
  });

  it('deltaIncentive for borrow side also shows dilution gap', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletBorrowUsd: 2000,
      // No borrowInput → hasInput=false
    });

    expect(result.borrow.hasInput).toBe(false);
    expect(result.borrow.deltaIncentive).not.toBeNull();
    expect(result.borrow.deltaIncentive!).toBeLessThan(0);
  });

  it('derives wallet from totalSupplyUsd - supplyInputUsd when hasInput=true', () => {
    // When hasInput=true and totalSupplyUsd is provided, wallet = total - delta
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',   // delta=$500
      totalSupplyUsd: 1500, // wallet=$1000 + delta=$500
    });

    expect(result.supply.hasInput).toBe(true);
    // wallet=$1000 = cap=$1000 → no dilution on current (1000/1000=1.0)
    // but after IS diluted (1500 > 1000 → 1000/1500)
    // deltaIncentive = currentIncentive - headlineIncentive = 0 (no wallet dilution)
    expect(result.supply.deltaIncentive).not.toBeNull();
    expect(result.supply.deltaIncentive!).toBe(0);
  });

  it('AAV-761: wallet-only position shows headline rates when hasInput=false (no dilution)', () => {
    // When hasInput=false but totalSupplyUsd is provided (wallet position),
    // walletSupplyUsd is set to undefined so currentIncentive shows headline
    // (undiluted) rates. The user hasn't changed anything, so the current
    // incentive should reflect the undiluted rate.
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '0',     // no supply delta
      borrowInput: '1',     // borrow delta=$1 (hasAnyInput=true)
      totalSupplyUsd: 1042, // wallet position > cap=$1000
      totalBorrowUsd: 1,
    });

    expect(result.supply.hasInput).toBe(false);
    // No dilution when hasInput=false: deltaIncentive is null
    expect(result.supply.deltaIncentive).toBeNull();
    // Current incentive should be headline (undiluted)
    expect(result.supply.currentIncentive).toBe(result.supply.headlineIncentive);
    // After incentive should be null (per-side guard, no supply input)
    expect(result.supply.afterIncentive).toBeNull();
  });

  it('derives wallet correctly when both totalSupplyUsd and supplyInputUsd are present', () => {
    // totalSupplyUsd = wallet(1500) + delta(500) = 2000
    // walletSupplyUsd should be derived as 2000 - 500 = 1500
    const result = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 2000,
      // No walletSupplyUsd passed explicitly
    });

    expect(result.supply.hasInput).toBe(true);
    // Wallet derivation should match explicit walletSupplyUsd=1500 result
    const withExplicitWallet = buildRateSimulationResult({
      reserve: MERIT_SELF_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 2000,
      walletSupplyUsd: 1500,
    });

    expect(result.supply.currentIncentive).toBeCloseTo(withExplicitWallet.supply.currentIncentive, 6);
  });
});
