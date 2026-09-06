import { describe, expect, it } from 'vitest';
import { buildRateSimulationResult, buildMeritCampaignDetails, buildMerklCampaignDetails, buildBrevisCampaignDetails, attachCampaigns, sumForecastBrevisIncentiveApr } from './rateSimulationCalculator';
import { convertAprToApy } from '@/lib/rateCalculations';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import type { ReserveWithSpread, MerklOpportunityGroup, MerklCampaignBreakdown } from '@/types/aave';

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

  it('applies a negative portfolio supply delta as a withdrawal', () => {
    const deposit = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    const withdrawal = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '-1000',
    });

    expect(withdrawal.utilization.after).toBeGreaterThan(deposit.utilization.after!);
  });

  it('caps a withdrawal at executable reserve liquidity for native rate simulation', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '-100000',
    });

    expect(result.utilization.after).toBeCloseTo(100, 6);
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

const MERIT_POSITION_CAP_RESERVE: ReserveWithSpread = {
  ...BASE_RESERVE,
  meritSupplys: [
    {
      link: 'https://example.com',
      name: 'Merit Test',
      message: [{ description: 'Base reward' }, { description: 'Self authentication. Cap: $1,000' }],
      breakdowns: [
        {
          campaignApr: 10,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-base',
        },
        {
          campaignApr: 8,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-self',
          positionCapUsd: 1000,
        },
      ],
    },
  ],
  meritBorrows: [
    {
      link: 'https://example.com',
      name: 'Merit Borrow Test',
      message: [{ description: 'Base reward' }, { description: 'Self authentication. Cap: $500' }],
      breakdowns: [
        {
          campaignApr: 5,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-borrow-base',
        },
        {
          campaignApr: 4,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-borrow-self',
          positionCapUsd: 500,
        },
      ],
    },
  ],
};

describe('Bug 2-4: merit position cap totalPositionUsd in campaign details & after sources', () => {
  it('Bug 2: campaign detail position cap after should be diluted when total position exceeds cap', () => {
    // Without principal: depositUsd=500, positionForCap=500, cap=1000 → no dilution
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });
    // With principal: totalPositionUsd=1500, depositUsd=500, cap=1000
    // eligible=min(1500,1000)=1000, dilution=1000/1500 ≈ 0.67
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 1500, // wallet=$1000 + delta=$500 → total=$1500 > cap=$1000
    });

    const noPrincipalCampaigns = withoutPrincipal.supply.sources.merit?.campaigns ?? [];
    const withPrincipalCampaigns = withPrincipal.supply.sources.merit?.campaigns ?? [];

    const selfCapRowNoPrincipal = noPrincipalCampaigns.find((r) => r.id === 'merit-0-1');
    const selfCapRowWithPrincipal = withPrincipalCampaigns.find((r) => r.id === 'merit-0-1');

    expect(selfCapRowNoPrincipal?.after).not.toBeNull();
    expect(selfCapRowWithPrincipal?.after).not.toBeNull();

    // With principal=$1500 > cap=$1000, self-cap should be diluted
    expect(selfCapRowWithPrincipal!.after!).toBeLessThan(selfCapRowNoPrincipal!.after!);
  });

  it('Bug 3: supply after sources merit should reflect position cap dilution with totalSupplyUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    const campaigns = result.supply.sources.merit?.campaigns ?? [];
    const baseRow = campaigns.find((r) => r.id === 'merit-0-0');
    const selfRow = campaigns.find((r) => r.id === 'merit-0-1');

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
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    const campaigns = result.borrow.sources.merit?.campaigns ?? [];
    const baseRow = campaigns.find((r) => r.id === 'merit-0-0');
    const selfRow = campaigns.find((r) => r.id === 'merit-0-1');

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
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.borrow.sources.merit?.after).not.toBeNull();
    expect(result.borrow.sources.merkl?.after).not.toBeNull();
    expect(result.borrow.sources.protocol?.after).not.toBeNull();
  });

  it('AAV-770: supply.afterIncentive reflects cross-side effect when only borrow has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    // AAV-761 F3: hasAnyInput guard preserves cross-side effect
    expect(result.supply.afterIncentive).not.toBeNull();
    expect(result.supply.deltaIncentive).not.toBeNull();
    // Native rate still preserves cross-side influence (utilization change)
    expect(result.supply.afterNative).not.toBeNull();
  });

  it('AAV-770: borrow.afterIncentive reflects cross-side effect when only supply has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    // AAV-761 F3: hasAnyInput guard preserves cross-side effect
    expect(result.borrow.afterIncentive).not.toBeNull();
    expect(result.borrow.deltaIncentive).not.toBeNull();
    expect(result.borrow.afterNative).not.toBeNull();
  });

  it('cross-side: supply reflects cross-side effect when only borrow has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    // Native rate still preserves cross-side influence (utilization change from borrow input)
    expect(result.supply.afterNative).not.toBeNull();
    // AAV-761 F3: hasAnyInput guard preserves cross-side incentive effect
    expect(result.supply.afterIncentive).not.toBeNull();
    expect(result.supply.afterTotal).not.toBeNull();
    // AAV-761 F3: delta also reflects cross-side influence
    expect(result.supply.deltaNative).not.toBeNull();
    expect(result.supply.deltaTotal).not.toBeNull();
  });

  it('cross-side: borrow reflects cross-side effect when only supply has input', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    // Native rate still preserves cross-side influence (utilization change from supply input)
    expect(result.borrow.afterNative).not.toBeNull();
    // AAV-761 F3: hasAnyInput guard preserves cross-side incentive effect
    expect(result.borrow.afterIncentive).not.toBeNull();
    expect(result.borrow.afterTotal).not.toBeNull();
    // AAV-761 F3: delta also reflects cross-side influence
    expect(result.borrow.deltaNative).not.toBeNull();
    expect(result.borrow.deltaTotal).not.toBeNull();
  });

  it('AAV-761 layer-3: supply delta reflects cross-side effect when only borrow has input (hasInput=false side)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '500',
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.deltaNative).not.toBeNull();
    expect(result.supply.deltaIncentive).not.toBeNull();
    expect(result.supply.deltaTotal).not.toBeNull();
  });

  it('AAV-761 layer-3: borrow delta reflects cross-side effect when only supply has input (hasInput=false side)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    expect(result.borrow.hasInput).toBe(false);
    expect(result.borrow.deltaNative).not.toBeNull();
    expect(result.borrow.deltaIncentive).not.toBeNull();
    expect(result.borrow.deltaTotal).not.toBeNull();
  });

  it('single simulation: position cap should NOT double-count when supplyInput used alone (no principal)', () => {
    // In single simulation mode, crossReservePositions stores the shared simulation input,
    // not a wallet position. totalSupplyUsd should NOT be passed.
    // This test guards against the regression where totalSupplyUsd = supplyInput
    // caused totalPositionUsd = 2× input (double-count) in merit self-cap dilution.
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      // NO totalSupplyUsd — correct for single simulation (no wallet position)
    });

    const campaigns = result.supply.sources.merit?.campaigns ?? [];
    const selfCapRow = campaigns.find((r) => r.id === 'merit-0-1');
    const baseRow = campaigns.find((r) => r.id === 'merit-0-0');

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
        link: 'https://example.com', name: 'Small Cap Test',
        message: [{ description: 'Base' }, { description: 'Self authentication. Cap: $200' }],
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: '2024-01-01',
            campaignEndedAt: '2030-12-31',
            campaignId: 'merit-base',
          },
          {
            campaignApr: 8,
            campaignStartedAt: '2024-01-01',
            campaignEndedAt: '2030-12-31',
            campaignId: 'merit-self',
            positionCapUsd: 200,
          },
        ],
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
      .find((r) => r.id === 'merit-0-1');
    const withWalletSelf = (withWallet.supply.sources.merit?.campaigns ?? [])
      .find((r) => r.id === 'merit-0-1');

    expect(noWalletSelf?.after).not.toBeNull();
    expect(withWalletSelf?.after).not.toBeNull();
    // With wallet, total position ($1000) > cap ($200), more dilution → lower after
    expect(withWalletSelf!.after!).toBeLessThan(noWalletSelf!.after!);
  });

  it('Bug 4: borrow after sources merit should reflect position cap dilution with totalBorrowUsd', () => {
    const withoutPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      borrowInput: '300',
    });
    const withPrincipal = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
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

describe('position cap dilution: buildIncentiveCurrent with wallet position', () => {
  // Fixture: MERIT_POSITION_CAP_RESERVE has supply self-cap = $1,000 (from selfMessage)
  it('current incentive should be diluted when wallet position exceeds position cap', () => {
    // Wallet=$1500 > self-cap=$1000 → dilution ratio = 1000/1500 ≈ 0.667
    // current incentive (with wallet) should be LOWER than undiluted headline rate
    const noWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    // With wallet position that exceeds cap
    const withWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
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
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      // No supplyInput, no wallet — delta should be null
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.deltaIncentive).toBeNull();
  });

  it('deltaIncentive is null when wallet exceeds cap but no input (AAV-1165: delta = after - current only)', () => {
    // Wallet=$1500 > self-cap=$1000 → current is diluted
    // AAV-1165: deltaIncentive is only after - current. No after → null.
    // Eligibility gap info (current vs headline) is separate structured data, not delta.
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
      // No supplyInput → hasInput=false
    });

    expect(result.supply.hasInput).toBe(false);
    // deltaIncentive is null — no after to compare against
    expect(result.supply.deltaIncentive).toBeNull();
    // currentIncentive is still diluted (wallet > cap)
    expect(result.supply.currentIncentive).toBeLessThan(result.supply.headlineIncentive);
  });

  it('deltaIncentive is null for borrow side when no input (AAV-1165)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletBorrowUsd: 2000,
      // No borrowInput → hasInput=false
    });

    expect(result.borrow.hasInput).toBe(false);
    expect(result.borrow.deltaIncentive).toBeNull();
  });

  it('derives wallet from totalSupplyUsd - supplyInputUsd when hasInput=true', () => {
    // When hasInput=true, deltaIncentive = afterIncentive - currentIncentive (simulation effect).
    // wallet=1000=cap=1000 → no dilution on current (1000/1000=1.0)
    // totalSupplyUsd=1500 > cap=1000 → after IS diluted (1000/1500)
    // deltaIncentive = diluted - headline < 0 (simulation dilution effect)
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',   // delta=$500
      totalSupplyUsd: 1500, // wallet=$1000 + delta=$500
    });

    expect(result.supply.hasInput).toBe(true);
    expect(result.supply.deltaIncentive).not.toBeNull();
    expect(result.supply.deltaIncentive!).toBeLessThan(0);
  });

  it('AAV-771: wallet-only position shows dilution currentIncentive and deltaIncentive', () => {
    // When wallet position exists, Deposit Ceiling dilution always applies,
    // regardless of hasInput. The dilution is a property of the wallet position
    // itself — $1,042 wallet vs $1,000 cap means only 1000/1042 gets incentive.
    // currentIncentive shows diluted rate, deltaIncentive shows wallet dilution gap.
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '0',     // no supply delta → hasInput=false
      borrowInput: '1',     // borrow delta=$1 (hasAnyInput=true, cross-side)
      totalSupplyUsd: 1042, // wallet position > cap=$1000
      totalBorrowUsd: 1,
    });

    expect(result.supply.hasInput).toBe(false);
    // Wallet dilution applies: deltaIncentive shows dilution gap
    expect(result.supply.deltaIncentive).not.toBeNull();
    expect(result.supply.deltaIncentive!).toBeLessThan(0);
    // Current incentive is diluted (wallet > cap) — delta < 0 proves this
    // After incentive reflects cross-side effect (hasAnyInput=true)
    expect(result.supply.afterIncentive).not.toBeNull();
  });

  it('uses explicit walletSupplyUsd for position cap dilution', () => {
    // totalSupplyUsd = wallet(1500) + delta(500) = 2000
    // walletSupplyUsd = 1500 > cap = 1000 → currentIncentive is diluted
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      totalSupplyUsd: 2000,
      walletSupplyUsd: 1500,
    });

    expect(result.supply.hasInput).toBe(true);
    // Wallet = 1500 > cap = 1000 → dilution = 1000/1500 ≈ 0.667
    // self-cap current = 8 * 0.667 ≈ 5.33, total current = 10 + 5.33 = 15.33
    expect(result.supply.currentIncentive).toBeCloseTo(15.333333, 1);
  });
});

describe('AAV-1165: Pure headline + unified delta', () => {
  it('headlineIncentive does not change when wallet position changes (purity)', () => {
    const noWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
    });

    const withWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '500',
      walletSupplyUsd: 1500,
    });

    // Headline must be identical regardless of wallet
    expect(withWallet.supply.headlineIncentive).toBeCloseTo(noWallet.supply.headlineIncentive, 6);
  });

  it('headlineIncentive equals advertised API rate (no forecast, no cap dilution)', () => {
    // MERIT_POSITION_CAP_RESERVE: base APR=10 + self APR=8 = 18 (advertised)
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500, // wallet > cap, but headline must NOT be diluted
    });

    // Headline = pure advertised rate = 10 + 8 = 18 (no cap, no wallet scaling)
    expect(result.supply.headlineIncentive).toBeCloseTo(18, 1);
  });

  it('deltaIncentive is null when afterIncentive is null (no current-headline path)', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
      // No supplyInput → hasInput=false → afterIncentive=null
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.afterIncentive).toBeNull();
    // AAV-1165: delta = after - current only. No after → null (not current - headline)
    expect(result.supply.deltaIncentive).toBeNull();
  });
});

describe('AAV-916: buildMeritCampaignDetails position cap capNote', () => {
  const merits = [
    {
      link: 'https://example.com',
      name: 'Merit Self-Cap Test',
      message: [{ description: 'Base reward' }, { description: 'Self authentication. Cap: $1,000' }],
      breakdowns: [
        {
          campaignApr: 10,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-base',
        },
        {
          campaignApr: 8,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-self',
          positionCapUsd: 1000,
        },
      ],
    },
  ];

  it('generates capNote when deposit exceeds self-position cap', () => {
    const rows = buildMeritCampaignDetails({
      merits, isApy: false, inputUsd: 5000, shouldComputeAfter: true,
    });
    const selfRow = rows.find((r) => r.id === 'merit-0-1');
    expect(selfRow).toBeDefined();
    expect(selfRow!.notes?.[0]?.text).toBeDefined();
    expect(selfRow!.notes?.[0]?.color).toBe('amber');
  });

  it('generates capNote but no capWarning when deposit is below cap', () => {
    const rows = buildMeritCampaignDetails({
      merits, isApy: false, inputUsd: 500, shouldComputeAfter: true,
    });
    const selfRow = rows.find((r) => r.id === 'merit-0-1');
    expect(selfRow).toBeDefined();
    expect(selfRow!.notes?.[0]?.text).toBeDefined();
    expect(selfRow!.notes?.[0]?.color).toBe('muted');
  });
});

describe('buildMerklCampaignDetails — forecastUnavailable flag', () => {
  const opportunities = [
    {
      name: 'Test Merkl',
      link: 'https://example.com',
      breakdowns: [
        {
          campaignId: 'camp-with-forecast',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignApr: 5,
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        },
        {
          campaignId: 'camp-without-forecast',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignApr: 3,
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        },
        {
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignApr: 2,
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        },
      ],
    },
  ] as unknown as MerklOpportunityGroup[];

  it('marks campaign as forecastUnavailable when forecastStates lacks the campaignId', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {
      'camp-with-forecast': { campaignId: 'camp-with-forecast', requiredDaily: 100, distributedSoFar: 50, endTimestamp: 2000000000 },
    };
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1, shouldComputeAfter: true,
    });
    const withoutForecast = rows.find((r) => r.id.includes('camp-without-forecast'));
    expect(withoutForecast).toBeDefined();
    expect(withoutForecast!.forecastUnavailable).toBe(true);
    expect(withoutForecast!.notes?.[0]?.text ?? '').not.toContain('No forecast data');
  });

  it('does not mark campaign as forecastUnavailable when forecastStates has the campaignId', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {
      'camp-with-forecast': { campaignId: 'camp-with-forecast', requiredDaily: 100, distributedSoFar: 50, endTimestamp: 2000000000 },
    };
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1, shouldComputeAfter: true,
    });
    const withForecast = rows.find((r) => r.id.includes('camp-with-forecast'));
    expect(withForecast).toBeDefined();
    expect(withForecast!.forecastUnavailable).toBeFalsy();
  });

  it('marks campaign as forecastUnavailable when mergeForecastState returns null (no campaignId)', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {};
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1, shouldComputeAfter: true,
    });
    const noIdRow = rows.find((r) => r.id.includes('-x'));
    expect(noIdRow).toBeDefined();
    expect(noIdRow!.forecastUnavailable).toBe(true);
    expect(noIdRow!.notes?.[0]?.text ?? '').not.toContain('No forecast data');
  });

  it('sets forecastUnavailable flag even when hasAnyInput is false (capNote not affected)', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {};
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1, shouldComputeAfter: false,
    });
    const unavailableRows = rows.filter((r) => r.forecastUnavailable);
    expect(unavailableRows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.notes?.[0]?.text ?? '').not.toContain('No forecast data');
    }
  });
});

describe('buildMerklCampaignDetails — position cap native amount display', () => {
  const opportunitiesWithPositionCap = [
    {
      name: 'Test Merkl',
      link: 'https://example.com',
      breakdowns: [
        {
          campaignId: 'merkl-capped',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignApr: 10,
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
          positionCapNative: '1000000000',
          isCombineCap: false,
        },
      ],
    },
  ];

  it('displays native token amount in capNote when tokenSymbol is provided', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {
      'merkl-capped': { campaignId: 'merkl-capped', requiredDaily: 100, distributedSoFar: 0, endTimestamp: 2000000000 },
    };
    const rows = buildMerklCampaignDetails({
      opportunities: opportunitiesWithPositionCap,
      isApy: false,
      inputUsd: 5000,
      forecastStates,
      tydroPointToUsdRate: 1,
      shouldComputeAfter: true,
      eligibilityRatio: 1,
      tokenPrice: 1,
      decimals: 6,
      tokenSymbol: 'USDT',
    });
    const cappedRow = rows.find((r) => r.id.includes('merkl-capped'));
    expect(cappedRow).toBeDefined();
    const capNote = cappedRow!.notes?.find((n) => n.type === 'position_cap');
    expect(capNote).toBeDefined();
    expect(capNote!.text).toContain('1,000.00 USDT');
    expect(capNote!.text).not.toContain('$');
  });

  it('falls back to USD when tokenSymbol is not provided', () => {
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {
      'merkl-capped': { campaignId: 'merkl-capped', requiredDaily: 100, distributedSoFar: 0, endTimestamp: 2000000000 },
    };
    const rows = buildMerklCampaignDetails({
      opportunities: opportunitiesWithPositionCap,
      isApy: false,
      inputUsd: 5000,
      forecastStates,
      tydroPointToUsdRate: 1,
      shouldComputeAfter: true,
      eligibilityRatio: 1,
      tokenPrice: 1,
      decimals: 6,
    });
    const cappedRow = rows.find((r) => r.id.includes('merkl-capped'));
    expect(cappedRow).toBeDefined();
    const capNote = cappedRow!.notes?.find((n) => n.type === 'position_cap');
    expect(capNote).toBeDefined();
    expect(capNote!.text).toContain('$');
  });
});

describe('buildMerklCampaignDetails — positionCap', () => {
  const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {};

  it('applies position cap dilution when breakdown has positionCap and positionUsd > positionCap', () => {
    const opportunities = [
      {
        name: 'Merkl Capped',
        link: 'https://example.com',
        breakdowns: [
          {
            campaignId: 'capped-camp',
            campaignApr: 10,
            campaignStartedAt: '2025-01-01',
            campaignEndedAt: '2030-12-31',
            positionCapUsd: 500,
            isCombineCap: false,
          },
        ],
      },
    ];
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1,
      shouldComputeAfter: true, eligibilityRatio: 1, grossInputUsd: 1000,
      grossForEligibility: 1000, netForEligibility: 1000,
    });
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.after).toBeLessThan(10);
    expect(row!.capMetrics).toBeDefined();
  });

  it('does not dilute when positionUsd <= positionCap', () => {
    const opportunities = [
      {
        name: 'Merkl Capped',
        link: 'https://example.com',
        breakdowns: [
          {
            campaignId: 'capped-camp',
            campaignApr: 10,
            campaignStartedAt: '2025-01-01',
            campaignEndedAt: '2030-12-31',
            positionCapUsd: 2000,
            isCombineCap: false,
          },
        ],
      },
    ];
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1,
      shouldComputeAfter: true, eligibilityRatio: 1, grossInputUsd: 1000,
      grossForEligibility: 1000, netForEligibility: 1000,
    });
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.after).toBeCloseTo(10, 1);
  });

  it('uses netForEligibility when netPositionConstraint exists', () => {
    const opportunities = [
      {
        name: 'Merkl Net',
        link: 'https://example.com',
        netPositionConstraint: { sourceSide: 'supply' as const, offsetReserveIds: ['r1'] },
        breakdowns: [
          {
            campaignId: 'net-camp',
            campaignApr: 10,
            campaignStartedAt: '2025-01-01',
            campaignEndedAt: '2030-12-31',
            positionCapUsd: 500,
            isCombineCap: false,
          },
        ],
      },
    ];
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1,
      shouldComputeAfter: true, eligibilityRatio: 1, grossInputUsd: 2000,
      grossForEligibility: 2000, netForEligibility: 1000,
    });
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.after).toBeLessThan(10);
  });

  it('skips position cap when breakdown has no positionCap', () => {
    const opportunities = [
      {
        name: 'Merkl No Cap',
        link: 'https://example.com',
        breakdowns: [
          {
            campaignId: 'no-cap-camp',
            campaignApr: 10,
            campaignStartedAt: '2025-01-01',
            campaignEndedAt: '2030-12-31',
          },
        ],
      },
    ];
    const rows = buildMerklCampaignDetails({
      opportunities, isApy: false, inputUsd: 1000, forecastStates, tydroPointToUsdRate: 1,
      shouldComputeAfter: true, eligibilityRatio: 1, grossInputUsd: 1000,
      grossForEligibility: 1000, netForEligibility: 1000,
    });
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.after).toBeCloseTo(10, 1);
    expect(row!.capMetrics).toBeUndefined();
  });
});

describe('buildBrevisCampaignDetails — forecastUnavailable flag', () => {
  it('marks brevis campaign as forecastUnavailable when forecastStates is provided but lacks campaignId', () => {
    const brevis = [
      {
        campaignId: 'brevis-1',
        link: 'https://example.com/brevis',
        campaignApr: 4,
        campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        campaignStartedAt: '2025-01-01',
        campaignEndedAt: '2030-12-31',
        message: 'Test Brevis',
        positionCapUsd: undefined,
        totalBudget: undefined,
      },
    ];
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {};
    const rows = buildBrevisCampaignDetails({
      items: brevis, isApy: false, inputUsd: 1000, shouldComputeAfter: true, forecastStates,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].forecastUnavailable).toBe(true);
    expect(rows[0].notes?.[0]?.text ?? '').not.toContain('No forecast data');
  });

  it('does not mark brevis campaign as forecastUnavailable when forecastStates has the campaign', () => {
    const brevis = [
      {
        campaignId: 'brevis-1',
        link: 'https://example.com/brevis',
        campaignApr: 4,
        campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        campaignStartedAt: '2025-01-01',
        campaignEndedAt: '2030-12-31',
        message: 'Test Brevis',
        positionCapUsd: undefined,
        totalBudget: undefined,
      },
    ];
    const forecastStates: Record<string, import('@/types/aave').MerklForecastWireItem> = {
      'brevis-1': { campaignId: 'brevis-1', requiredDaily: 50, distributedSoFar: 20, endTimestamp: 2000000000 },
    };
    const rows = buildBrevisCampaignDetails({
      items: brevis, isApy: false, inputUsd: 1000, shouldComputeAfter: true, forecastStates,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].forecastUnavailable).toBeFalsy();
  });
});

describe('Brevis position cap — totalPositionUsd fallback (AAV-1060 #10)', () => {
  const brevisWithCap = [
    {
      campaignId: 'brevis-cap-1',
      link: 'https://example.com/brevis',
      campaignApr: 10,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2030-12-31',
      message: 'Brevis Cap Test',
      positionCapUsd: 5000,
      totalBudget: undefined,
    },
  ];

  it('uses totalPositionUsd as fallback when combined deposits are absent', () => {
    const resultWithTotal = sumForecastBrevisIncentiveApr(
      brevisWithCap, false, 0, undefined, undefined, 20000,
    );
    const resultWithInputOnly = sumForecastBrevisIncentiveApr(
      brevisWithCap, false, 0, undefined, undefined, undefined,
    );
    expect(resultWithTotal).toBeLessThan(10);
    expect(resultWithInputOnly).toBe(10);
  });

  it('prefers combined deposits over totalPositionUsd', () => {
    const sharedDeposits = new Map([['brevis-cap-1', 3000]]);
    const resultWithCombined = sumForecastBrevisIncentiveApr(
      brevisWithCap, false, 0, sharedDeposits, undefined, 20000,
    );
    const resultWithTotalOnly = sumForecastBrevisIncentiveApr(
      brevisWithCap, false, 0, undefined, undefined, 20000,
    );
    expect(resultWithCombined).not.toBe(resultWithTotalOnly);
  });

  it('buildBrevisCampaignDetails uses totalPositionUsd for position cap', () => {
    const rowsWithTotal = buildBrevisCampaignDetails({
      items: brevisWithCap, isApy: false, inputUsd: 0, shouldComputeAfter: true, totalPositionUsd: 20000,
    });
    const rowsWithInputOnly = buildBrevisCampaignDetails({
      items: brevisWithCap, isApy: false, inputUsd: 0, shouldComputeAfter: true,
    });
    expect(rowsWithTotal.length).toBe(1);
    expect(rowsWithInputOnly.length).toBe(1);
    expect(rowsWithTotal[0].current).toBe(10);
    expect(rowsWithTotal[0].after).toBeLessThan(10);
    expect(rowsWithInputOnly[0].current).toBe(10);
  });
});

describe('forecastUnavailableCampaignCount — expanded counting', () => {
  it('counts campaigns without campaignId (mergeForecastState returns null)', () => {
    const reserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      merklSupplys: [{
        name: 'Merkl No ID',
        breakdowns: [{
          campaignApr: 3,
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        }] as unknown as MerklCampaignBreakdown[],
      }],
    };
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    expect(result.forecastUnavailableCampaignCount).toBeGreaterThanOrEqual(1);
    const supplyMerklCampaigns = result.supply.sources.merkl.campaigns ?? [];
    const noIdRow = supplyMerklCampaigns.find((r) => r.forecastUnavailable);
    expect(noIdRow).toBeDefined();
  });

  it('counts Brevis campaigns without forecast', () => {
    const reserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      brevisSupplys: [{
        campaignApr: 4,
        campaignId: 'brevis-no-forecast',
        link: 'https://example.com/brevis',
        campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        campaignStartedAt: '2025-01-01',
        campaignEndedAt: '2030-12-31',
        message: 'Brevis No Forecast',
        positionCapUsd: undefined,
        totalBudget: undefined,
      }],
    };
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });
    expect(result.forecastUnavailableCampaignCount).toBeGreaterThanOrEqual(1);
    const brevisCampaigns = result.supply.sources.brevis.campaigns ?? [];
    const brevisRow = brevisCampaigns.find((r) => r.forecastUnavailable);
    expect(brevisRow).toBeDefined();
  });

  it('does not count campaigns with available forecast', () => {
    const reserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      merklSupplys: [{
        name: 'Merkl With Forecast',
        breakdowns: [{
          campaignApr: 3,
          campaignId: 'has-forecast',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        }],
      }],
    };
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      forecastStates: {
        'has-forecast': { campaignId: 'has-forecast', requiredDaily: 100, distributedSoFar: 50, endTimestamp: 2000000000 },
      },
    });
    expect(result.forecastUnavailableCampaignCount).toBe(0);
  });

  it('sums across supply and borrow sides', () => {
    const reserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      merklSupplys: [{
        name: 'Merkl Supply No Forecast',
        breakdowns: [{
          campaignApr: 3,
          campaignId: 'supply-no-forecast',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        }],
      }],
      merklBorrows: [{
        name: 'Merkl Borrow No Forecast',
        breakdowns: [{
          campaignApr: 2,
          campaignId: 'borrow-no-forecast',
          campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
          campaignStartedAt: '2025-01-01',
          campaignEndedAt: '2030-12-31',
        }],
      }],
    };
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
      borrowInput: '500',
    });
    expect(result.forecastUnavailableCampaignCount).toBeGreaterThanOrEqual(2);
  });
});

describe('AAV-975: anchorTvlUsd TVL_DILUTION per-source merit.after', () => {
  it('per-source merit.after uses TVL_DILUTION (not CURRENT_RATE) when anchorTvlUsd is available', () => {
    const RESERVE_WITH_SUPPLIED: ReserveWithSpread = {
      ...BASE_RESERVE,
      supplied: '10000000000000000000000',
      meritSupplys: [{
        link: 'https://example.com',
        name: 'Merit TVL Test',
        message: [{ description: 'Base reward' }],
        breakdowns: [{
          campaignApr: 10,
          campaignStartedAt: '2024-01-01',
          campaignEndedAt: '2030-12-31',
          campaignId: 'merit-tvl-base',
        }],
      }],
    };

    const result = buildRateSimulationResult({
      reserve: RESERVE_WITH_SUPPLIED,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      supplyInput: '1000',
    });

    // Dispatch map passes real anchorTvlUsd → TVL_DILUTION mode → after < current
    expect(result.supply.sources.merit?.after).not.toBeNull();
    expect(result.supply.sources.merit!.current!).toBeGreaterThan(0);
    expect(result.supply.sources.merit!.after!).toBeLessThan(result.supply.sources.merit!.current!);
  });
});

describe('AAV-979: per-source Merit current includes position cap dilution', () => {
  it('per-source merit.current is diluted when walletPositionUsd exceeds positionCap', () => {
    const noWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
    });

    expect(withWallet.supply.sources.merit!.current)
      .toBeLessThan(noWallet.supply.sources.merit!.current);
  });

  it('per-source merit.current + other sources ≈ total currentIncentive when wallet exceeds cap', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
    });

    const meritCurrent = result.supply.sources.merit!.current;
    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const brevisCurrent = result.supply.sources.brevis?.current ?? 0;
    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const perSourceSum = meritCurrent + merklCurrent + brevisCurrent + protocolCurrent;

    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 1);
  });

  it('per-source merit.current equals headline when walletPositionUsd is undefined', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    expect(result.supply.sources.merit!.current).toBeGreaterThanOrEqual(17);
  });

  it('per-source merit.current reflects dilution ratio when wallet exceeds cap', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 10000,
    });

    // headline = 10 (base) + 8 (self) = 18
    // cap = 1000, wallet = 10000, dilution on self row = min(10000,1000)/10000 = 0.1
    // diluted self = 8 * 0.1 = 0.8, total = 10 + 0.8 = 10.8
    expect(result.supply.sources.merit!.current).toBeCloseTo(10.8, 1);
  });

  it('per-campaign current is also diluted when wallet exceeds cap', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
    });

    const selfCampaign = result.supply.sources.merit!.campaigns
      .find(c => c.id.includes('merit-0-1'));
    expect(selfCampaign).toBeDefined();
    // Self campaign: headline=8, cap=1000, wallet=1500
    // diluted = 8 * min(1500,1000)/1500 = 8 * 0.667 ≈ 5.33
    expect(selfCampaign!.current).toBeLessThan(8);
  });

  it('no positionCap campaign current is unchanged regardless of wallet', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletSupplyUsd: 1500,
    });

    const baseCampaign = result.supply.sources.merit!.campaigns
      .find(c => c.id.includes('merit-0-0'));
    expect(baseCampaign).toBeDefined();
    expect(baseCampaign!.current).toBe(10);
  });

  it('borrow side merit.current also respects position cap dilution', () => {
    const noWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
    });

    const withWallet = buildRateSimulationResult({
      reserve: MERIT_POSITION_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      ...BASE_PARAMS,
      walletBorrowUsd: 2000,
    });

    expect(withWallet.borrow.sources.merit!.current)
      .toBeLessThan(noWallet.borrow.sources.merit!.current);
  });
});

describe('attachCampaigns: offsetNotes separation (AAV-1036)', () => {
  const metric = { current: 1, after: 2, delta: 1 };
  const offsetNote: import('./incentiveCaps').IncentiveNote = { type: 'net_eligible', text: '$500 of $1,000 net eligible', color: 'muted' };
  const campaigns = [
    { id: 'c1', label: 'Campaign 1', current: 0.5, after: 0.6, delta: 0.1 },
    { id: 'c2', label: 'Campaign 2', current: 0.3, after: 0.4, delta: 0.1 },
    { id: 'c3', label: 'Campaign 3', current: 0.2, after: 0.3, delta: 0.1 },
  ];

  it('does NOT attach offsetNotes to campaign rows', () => {
    const result = attachCampaigns(metric, campaigns, [offsetNote]);
    expect(result.campaigns).toHaveLength(3);
    for (const c of result.campaigns!) {
      expect(c.notes).toBeUndefined();
    }
  });

  it('preserves existing campaign cap notes without polluting with offsetNotes', () => {
    const capNote = { type: 'position_cap' as const, text: 'cap hit', color: 'amber' as const };
    const campaignWithNote = { ...campaigns[0], notes: [capNote] };
    const result = attachCampaigns(metric, [campaignWithNote, campaigns[1]], [offsetNote]);
    expect(result.campaigns![0].notes).toEqual([capNote]);
    expect(result.campaigns![1].notes).toBeUndefined();
  });

  it('returns offsetNotes on the source-level offsetNotes field', () => {
    const result = attachCampaigns(metric, campaigns, [offsetNote]);
    expect(result.offsetNotes).toEqual([offsetNote]);
    expect(result.notes).toBeUndefined();
  });

  it('returns campaigns unchanged when no offsetNotes', () => {
    const result = attachCampaigns(metric, campaigns);
    expect(result.campaigns).toEqual(campaigns);
    expect(result.offsetNotes).toBeUndefined();
  });

  it('returns offsetNotes and no campaigns when campaigns empty', () => {
    const result = attachCampaigns(metric, [], [offsetNote]);
    expect(result.campaigns).toBeUndefined();
    expect(result.offsetNotes).toEqual([offsetNote]);
  });
});

describe('AAV-1060: Merkl wallet position in net position constraint', () => {
  const USDE_RESERVE_ID = '1:0xusde:0xusde';

  const MERKL_CONSTRAINT_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [
      {
        name: 'USDT0 net lending',
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'net-lend-test',
          },
        ],
        opportunityId: '999',
        netPositionConstraint: {
          sourceSide: 'supply',
          offsetReserveIds: [USDE_RESERVE_ID],
        },
      },
    ],
  };

  it('Bug 1: merklGroupMultiplier uses total position for cross-reserve eligibility when supplyInputUsd=0 but wallet position exists', () => {
    const crossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const walletCrossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const result = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '1',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1042,
      totalBorrowUsd: 1,
      walletSupplyUsd: 1042,
      crossReservePositions,
      walletCrossReservePositions,
    });

    const perSourceMerklCurrent = result.supply.sources.merkl?.current ?? 0;

    // wallet supply=1042, cross-reserve borrow=600
    // net eligible = max(1042-600, 0) = 442
    // eligibility ratio = 442/1042 ≈ 0.424
    // expected current = 10 * 0.424 ≈ 4.24
    // With Bug 1 (grossUsd=0 → crossReserveRatio=1): current = 10 * 0.999 ≈ 10
    // After fix: current ≈ 4.24
    expect(perSourceMerklCurrent).toBeCloseTo(4.24, 1);
  });

  it('Bug 1: without wallet position, current = headline (no scaling) — GOLDEN RULE', () => {
    const crossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const result = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });

    // GOLDEN RULE (AAV-1121): No wallet → current = headline (no eligibility scaling).
    // current = 10 (undiluted, unscaled). after reflects simulation scaling.
    expect(result.supply.sources.merkl?.current ?? 0).toBeCloseTo(10.0, 1);
  });

  it('Bug 2: aggregate currentIncentive matches per-source sum for Merkl with constraint', () => {
    const crossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const walletCrossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const result = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '1',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1042,
      totalBorrowUsd: 1,
      walletSupplyUsd: 1042,
      crossReservePositions,
      walletCrossReservePositions,
    });

    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const perSourceSum = merklCurrent + protocolCurrent;

    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 1);
  });

  it('headline incentive also includes eligibility scaling (AAV-1060 review fix)', () => {
    const crossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);
    const walletCrossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const withConstraint = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1042,
      totalBorrowUsd: 1,
      walletSupplyUsd: 1042,
      crossReservePositions,
      walletCrossReservePositions,
    });

    const noConstraint: ReserveWithSpread = {
      ...MERKL_CONSTRAINT_RESERVE,
      merklSupplys: [{
        name: 'Standard merkl',
        breakdowns: [{
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'std-test',
        }],
        opportunityId: '998',
      }],
    };

    const withoutConstraint = buildRateSimulationResult({
      reserve: noConstraint,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1042,
      totalBorrowUsd: 1,
      walletSupplyUsd: 1042,
    });

    expect(withConstraint.supply.currentIncentive).toBeLessThan(withoutConstraint.supply.currentIncentive);
  });

  it('merklCrossReserveNote uses total position for grossUsd when supplyInputUsd=0 but wallet exists', () => {
    const crossReservePositions = new Map([
      [USDE_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const result = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '1',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1042,
      totalBorrowUsd: 1,
      crossReservePositions,
    });

    const merklOffsetNotes = result.supply.sources.merkl?.offsetNotes;
    expect(merklOffsetNotes).toBeDefined();
    expect(merklOffsetNotes!.length).toBeGreaterThan(0);
    const noteText = merklOffsetNotes![0].text;
    expect(noteText).toContain('$1,042');
    expect(noteText).toContain('net eligible');
  });
});

describe('AAV-1164: Merkl campaign details use unified eligibility', () => {
  it('keeps the capped campaign row aligned with the Merkl source aggregate', () => {
    const offsetReserveId = '1:0xoffset:0xoffset';
    const reserve: ReserveWithSpread = {
      ...BASE_RESERVE,
      merklSupplys: [
        {
          name: 'Capped net lending',
          breakdowns: [
            {
              campaignApr: 10,
              campaignStartedAt: '2020-01-01T00:00:00.000Z',
              campaignEndedAt: '2099-01-01T00:00:00.000Z',
              campaignId: 'capped-net-lending',
              positionCapUsd: 1000,
            },
          ],
          netPositionConstraint: {
            sourceSide: 'supply',
            offsetReserveIds: [offsetReserveId],
          },
        },
      ],
    };
    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1500',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: false,
      totalSupplyUsd: 1500,
      crossReservePositions: new Map([
        [offsetReserveId, { supplyUsd: 0, borrowUsd: 500 }],
      ]),
    });

    const campaign = result.supply.sources.merkl?.campaigns?.[0];
    expect(campaign?.after).toBeCloseTo(6.667, 3);
    expect(result.supply.sources.merkl?.after).toBeCloseTo(6.667, 3);
    expect(result.supply.afterIncentive).toBeCloseTo(6.667, 3);
  });
});

// ─── AAV-1102: per-source sumCurrent vs per-campaign current consistency ───

describe('AAV-1102: Merit per-campaign current uses walletEligibilityRatio', () => {
  const MERIT_ELIGIBILITY_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    meritSupplys: [{
      link: 'https://example.com',
      name: 'Merit Test',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merit-elig-test',
      }],
    }],
  };

  it('per-campaign current is scaled by walletEligibilityRatio when wallet has borrow offset', () => {
    // wallet supply=$1000, wallet borrow=$400 → walletEligibilityRatio = 600/1000 = 0.6
    // current should be 10 * 0.6 = 6.0 (not 10)
    const result = buildRateSimulationResult({
      reserve: MERIT_ELIGIBILITY_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 400,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 400,
    });

    const meritCampaigns = result.supply.sources.merit?.campaigns ?? [];
    expect(meritCampaigns.length).toBe(1);
    // per-campaign current should match aggregate current (both scaled by walletEligibilityRatio)
    expect(meritCampaigns[0].current).toBeCloseTo(result.supply.sources.merit?.current ?? -1, 4);
    // current should be 6.0 (10 * 0.6)
    expect(meritCampaigns[0].current).toBeCloseTo(6.0, 1);
  });

  it('per-campaign current sum matches aggregate sumCurrent', () => {
    const result = buildRateSimulationResult({
      reserve: MERIT_ELIGIBILITY_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 400,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 400,
    });

    const meritCampaigns = result.supply.sources.merit?.campaigns ?? [];
    const perCampaignSum = meritCampaigns.reduce((s, c) => s + c.current, 0);
    expect(perCampaignSum).toBeCloseTo(result.supply.sources.merit?.current ?? -1, 4);
  });
});

describe('AAV-1102: Merkl per-campaign current uses wallet multiplier + eligibility', () => {
  const OFFSET_RESERVE_ID = '1:0xusds:0xusds';

  const MERKL_WALLET_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    reserveId: OFFSET_RESERVE_ID,
    merklSupplys: [{
      name: 'Net lending',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merkl-elig-test',
      }],
      opportunityId: '999',
      netPositionConstraint: {
        sourceSide: 'supply',
        offsetReserveIds: [OFFSET_RESERVE_ID],
      },
    }],
  };

  it('per-campaign current uses wallet positions (not simulated) for eligibility', () => {
    // wallet supply=$1000, wallet borrow=$0 → walletEligibilityRatio = 1.0
    // simulated: supply=$1000, borrow=$500 → simulatedEligibilityRatio = 0.5
    // current should use wallet (1.0), after should use simulated (0.5)
    const result = buildRateSimulationResult({
      reserve: MERKL_WALLET_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '500',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 500,
    });

    const merklCampaigns = result.supply.sources.merkl?.campaigns ?? [];
    expect(merklCampaigns.length).toBe(1);
    // current uses wallet ratio (1.0) → 10 * 1.0 = 10
    // offsetReserveIds includes self, so crossReserveRatio = max(1000-0, 0)/1000 = 1.0
    expect(merklCampaigns[0].current).toBeCloseTo(10, 1);
    // per-campaign current should match aggregate current
    expect(merklCampaigns[0].current).toBeCloseTo(result.supply.sources.merkl?.current ?? -1, 4);
  });

  it('per-campaign current sum matches aggregate sumCurrent with constraint', () => {
    const result = buildRateSimulationResult({
      reserve: MERKL_WALLET_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '500',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 500,
    });

    const merklCampaigns = result.supply.sources.merkl?.campaigns ?? [];
    const perCampaignSum = merklCampaigns.reduce((s, c) => s + c.current, 0);
    expect(perCampaignSum).toBeCloseTo(result.supply.sources.merkl?.current ?? -1, 4);
  });
});

describe('AAV-1102: Brevis per-campaign current applies wallet position cap dilution', () => {
  const BREVIS_CAP_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    brevisSupplys: [{
      campaignId: 'brevis-cap-test',
      link: 'https://example.com/brevis',
      campaignApr: 10,
      campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      campaignStartedAt: '2025-01-01T00:00:00.000Z',
      campaignEndedAt: '2099-01-01T00:00:00.000Z',
      message: 'Brevis Cap Test',
      positionCapUsd: 5000,
      totalBudget: undefined,
      breakdowns: [{
        campaignId: 'brevis-cap-test',
        campaignApr: 10,
        campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
        campaignStartedAt: '2025-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        positionCapUsd: 5000,
        totalBudget: undefined,
      }],
    }],
  };

  it('per-campaign current is diluted when wallet exceeds positionCapUsd', () => {
    // wallet=$10000 > cap=$5000 → dilution = 5000/10000 = 0.5
    // current should be 10 * 0.5 = 5.0 (not 10)
    const result = buildRateSimulationResult({
      reserve: BREVIS_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 10000,
      walletSupplyUsd: 10000,
    });

    const brevisCampaigns = result.supply.sources.brevis?.campaigns ?? [];
    expect(brevisCampaigns.length).toBe(1);
    // per-campaign current should be diluted
    expect(brevisCampaigns[0].current).toBeLessThan(10);
    expect(brevisCampaigns[0].current).toBeCloseTo(5.0, 1);
    // per-campaign current should match aggregate current
    expect(brevisCampaigns[0].current).toBeCloseTo(result.supply.sources.brevis?.current ?? -1, 4);
  });

  it('per-campaign current is NOT diluted when wallet is below positionCapUsd', () => {
    // wallet=$3000 < cap=$5000 → no dilution
    const result = buildRateSimulationResult({
      reserve: BREVIS_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 3000,
      walletSupplyUsd: 3000,
    });

    const brevisCampaigns = result.supply.sources.brevis?.campaigns ?? [];
    expect(brevisCampaigns.length).toBe(1);
    // no dilution → current = 10
    expect(brevisCampaigns[0].current).toBeCloseTo(10, 1);
    expect(brevisCampaigns[0].current).toBeCloseTo(result.supply.sources.brevis?.current ?? -1, 4);
  });

  it('per-campaign current sum matches aggregate sumCurrent', () => {
    const result = buildRateSimulationResult({
      reserve: BREVIS_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 10000,
      walletSupplyUsd: 10000,
    });

    const brevisCampaigns = result.supply.sources.brevis?.campaigns ?? [];
    const perCampaignSum = brevisCampaigns.reduce((s, c) => s + c.current, 0);
    expect(perCampaignSum).toBeCloseTo(result.supply.sources.brevis?.current ?? -1, 4);
  });
});

describe('AAV-1102: aggregate sumCurrent matches buildIncentiveCurrent for all sources', () => {
  const ALL_SOURCES_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [2],
    meritSupplys: [{
      link: 'https://example.com',
      name: 'Merit',
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merit-agg',
      }],
    }],
    merklSupplys: [{
      name: 'Merkl',
      breakdowns: [{
        campaignApr: 8,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merkl-agg',
      }],
      opportunityId: '997',
    }],
  };

  it('sum of per-source current equals aggregate currentIncentive', () => {
    // wallet supply=$2000, wallet borrow=$500 → eligibilityRatio = 1500/2000 = 0.75
    const result = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 2000,
      totalBorrowUsd: 500,
      walletSupplyUsd: 2000,
      walletBorrowUsd: 500,
    });

    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const meritCurrent = result.supply.sources.merit?.current ?? 0;
    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const brevisCurrent = result.supply.sources.brevis?.current ?? 0;
    const perSourceSum = protocolCurrent + meritCurrent + merklCurrent + brevisCurrent;

    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 4);
  });
});

describe('AAV-1107: aggregate currentIncentive matches per-source sum with Merkl position cap', () => {
  const MERKL_POSCAP_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    merklSupplys: [{
      name: 'Capped campaign',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'poscap-test',
        positionCapNative: '1000000000000000000000', // 1000 tokens (18 decimals) = $1000
      }],
      opportunityId: '998',
    }],
  };

  it('aggregate currentIncentive = per-source sum when wallet exceeds Merkl position cap', () => {
    // wallet supply=$5000, position cap=$1000 → dilution applies
    // Before fix: buildIncentiveCurrent didn't pass positionUsd to Merkl → no dilution → aggregate > per-source
    // After fix: buildIncentiveCurrent passes positionUsd → dilution applied → aggregate = per-source
    const result = buildRateSimulationResult({
      reserve: MERKL_POSCAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 0,
      walletSupplyUsd: 5000,
    });

    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const meritCurrent = result.supply.sources.merit?.current ?? 0;
    const brevisCurrent = result.supply.sources.brevis?.current ?? 0;
    const perSourceSum = protocolCurrent + meritCurrent + merklCurrent + brevisCurrent;

    // Per-source should have cap dilution: 10% * (1000/5000) = 2%
    expect(merklCurrent).toBeCloseTo(2, 1);
    // Aggregate must match per-source sum
    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 4);
  });

  it('aggregate currentIncentive = per-source sum when wallet below Merkl position cap', () => {
    // wallet supply=$500, position cap=$1000 → no dilution
    const result = buildRateSimulationResult({
      reserve: MERKL_POSCAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 500,
      totalBorrowUsd: 0,
      walletSupplyUsd: 500,
    });

    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const meritCurrent = result.supply.sources.merit?.current ?? 0;
    const brevisCurrent = result.supply.sources.brevis?.current ?? 0;
    const perSourceSum = protocolCurrent + meritCurrent + merklCurrent + brevisCurrent;

    // No dilution: 10% * (500/500) = 10%... wait, position cap means max(500, 1000) = 500, so no dilution
    expect(merklCurrent).toBeCloseTo(10, 1);
    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 4);
  });
});

describe('AAV-1112: currentIncentive derived from per-source sum (no independent path)', () => {
  // Structural test: currentIncentive must equal the sum of per-source current values.
  // This ensures there is only ONE code path for computing current incentive.
  const ALL_SOURCES_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [1.0],
    meritSupplys: [{
      name: 'Merit campaign',
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merit-1112',
      }],
    }],
    merklSupplys: [{
      name: 'Merkl campaign',
      breakdowns: [{
        campaignApr: 8,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merkl-1112',
        positionCapNative: '1000000000000000000000', // $1000 cap
      }],
      opportunityId: '1112',
    }],
  };

  it('supply currentIncentive = protocol + merit + merkl + brevis current', () => {
    const result = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000, // exceeds Merkl cap → dilution
      totalBorrowUsd: 0,
      walletSupplyUsd: 5000,
    });

    const p = result.supply.sources.protocol?.current ?? 0;
    const m = result.supply.sources.merit?.current ?? 0;
    const k = result.supply.sources.merkl?.current ?? 0;
    const b = result.supply.sources.brevis?.current ?? 0;

    expect(p + m + k + b).toBeCloseTo(result.supply.currentIncentive, 6);
  });

  it('borrow currentIncentive = protocol + merit + merkl + brevis current', () => {
    const BORROW_RESERVE: ReserveWithSpread = {
      ...ALL_SOURCES_RESERVE,
      borrowIncentives: [0.5],
      meritBorrows: [{
        name: 'Merit borrow',
        breakdowns: [{
          campaignApr: 3,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'merit-b-1112',
        }],
      }],
    };

    const result = buildRateSimulationResult({
      reserve: BORROW_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalBorrowUsd: 5000,
      totalSupplyUsd: 0,
      walletBorrowUsd: 5000,
    });

    const p = result.borrow.sources.protocol?.current ?? 0;
    const m = result.borrow.sources.merit?.current ?? 0;
    const k = result.borrow.sources.merkl?.current ?? 0;
    const b = result.borrow.sources.brevis?.current ?? 0;

    expect(p + m + k + b).toBeCloseTo(result.borrow.currentIncentive, 6);
  });
});

describe('AAV-1113: afterIncentive derived from per-source sum (no independent path)', () => {
  // Structural test: afterIncentive must equal the sum of per-source after values.
  // This ensures there is only ONE code path for computing after incentive,
  // eliminating the buildIncentiveAfter + aggregate Math.min dual-path bug.
  const ALL_SOURCES_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [1.0],
    meritSupplys: [{
      name: 'Merit campaign',
      breakdowns: [{
        campaignApr: 5,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merit-1113',
      }],
    }],
    merklSupplys: [{
      name: 'Merkl campaign',
      breakdowns: [{
        campaignApr: 8,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'merkl-1113',
        positionCapNative: '1000000000000000000000', // $1000 cap
      }],
      opportunityId: '1113',
    }],
  };

  it('supply afterIncentive = protocol + merit + merkl + brevis after (with input)', () => {
    const result = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000, // exceeds Merkl cap → dilution
      totalBorrowUsd: 0,
      walletSupplyUsd: 4500, // wallet = 5000 - 500 delta
    });

    expect(result.supply.afterIncentive).not.toBeNull();
    const p = result.supply.sources.protocol?.after ?? 0;
    const m = result.supply.sources.merit?.after ?? 0;
    const k = result.supply.sources.merkl?.after ?? 0;
    const b = result.supply.sources.brevis?.after ?? 0;

    expect(p + m + k + b).toBeCloseTo(result.supply.afterIncentive!, 6);
  });

  it('supply afterIncentive changes when borrow reduces eligibility (cross-side effect)', () => {
    // With netPositionConstraint, adding borrow should reduce supply after incentive.
    const rNoBorrow = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 0,
      walletSupplyUsd: 4500,
    });
    const rWithBorrow = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '2000',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 2000,
      walletSupplyUsd: 4500,
      walletBorrowUsd: 2000,
    });

    expect(rNoBorrow.supply.afterIncentive).not.toBeNull();
    expect(rWithBorrow.supply.afterIncentive).not.toBeNull();
    // After with borrow should be <= after without borrow (eligibility reduced)
    expect(rWithBorrow.supply.afterIncentive!).toBeLessThanOrEqual(rNoBorrow.supply.afterIncentive!);
  });

  it('afterIncentive is null when hasAnyInput is false', () => {
    const result = buildRateSimulationResult({
      reserve: ALL_SOURCES_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 0,
      walletSupplyUsd: 5000,
    });

    expect(result.supply.afterIncentive).toBeNull();
  });
});

describe('Golden Rule: currentIncentive must NOT change with simulation input (AAV-1121)', () => {
  // GOLDEN RULE: current* fields represent the wallet's present state.
  // They must NEVER change when simulation inputs change.
  // If no wallet exists (Shared Scenario), current = headline (undiluted, no eligibility scaling).
  const MERKL_CONSTRAINT_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [] as number[],
    merklSupplys: [{
      name: 'Net lending group',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'golden-rule-1',
      }],
      opportunityId: '99',
      netPositionConstraint: {
        sourceSide: 'supply',
        offsetReserveIds: [BASE_RESERVE.reserveId],
      },
    }],
  };

  it('Shared Scenario: current unchanged when borrow added (no wallet → no eligibility scaling)', () => {
    const crp1 = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 10000, borrowUsd: 0 }]]);
    const r1 = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '10000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions: crp1,
    });

    const crp2 = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 10000, borrowUsd: 5000 }]]);
    const r2 = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '10000',
      borrowInput: '5000',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions: crp2,
    });

    // current MUST be the same — it represents the wallet's present state (none in Shared mode)
    expect(r1.supply.currentIncentive).toBeCloseTo(r2.supply.currentIncentive, 6);
    // after SHOULD differ — it reflects the simulation
    expect(r1.supply.afterIncentive).not.toBeCloseTo(r2.supply.afterIncentive!, 2);
  });

  it('Portfolio: current unchanged when borrow delta added (wallet-only values)', () => {
    const crp1 = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 10000, borrowUsd: 0 }]]);
    const r1 = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 10000,
      totalBorrowUsd: 0,
      crossReservePositions: crp1,
    });

    const crp2 = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 10000, borrowUsd: 5000 }]]);
    const r2 = buildRateSimulationResult({
      reserve: MERKL_CONSTRAINT_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '5000',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 10000,
      totalBorrowUsd: 5000,
      crossReservePositions: crp2,
    });

    // current MUST be the same — wallet positions haven't changed
    expect(r1.supply.currentIncentive).toBeCloseTo(r2.supply.currentIncentive, 6);
  });
});

describe('AAV-1120: walletBorrowUsd/walletSupplyUsd derivation must use raw (uncapped) input', () => {
  // When borrow/supply delta exceeds available room, the input gets capped for rate
  // simulation. But wallet position derivation must use the RAW (uncapped) input,
  // because totalBorrowUsd = wallet + rawDelta, so wallet = total - rawDelta.
  // Using capped delta gives wallet = total - cappedDelta → wallet too large.

  const BORROW_CAP_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    borrowed: '0',
    supplied: '0',
    liquidity: '10000000000000000000000', // 10000
    borrowCap: '1000000000000000000000', // 1000 — small cap to trigger capping
    supplyCap: '10000000000000000000000', // 10000 — plenty
    merklBorrows: [{
      name: 'Net lending borrow group',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'aav1120-borrow-1',
      }],
      opportunityId: '1120',
      netPositionConstraint: {
        sourceSide: 'borrow',
        offsetReserveIds: [BASE_RESERVE.reserveId],
      },
    }],
  };

  it('borrow currentIncentive is same whether delta is under or over borrow cap (same wallet)', () => {
    // Wallet: supply=$5000, borrow=$8000
    // The wallet position is identical in both scenarios.

    // Scenario A: delta borrow = $500 (under cap of $1000)
    // totalBorrowUsd = 8000 + 500 = 8500
    // rawBorrowInputUsd = 500, borrowInputUsd = 500 (no capping)
    // walletBorrowUsd = 8500 - 500 = 8000 ✓
    const crpA = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 5000, borrowUsd: 8000 }]]);
    const rA = buildRateSimulationResult({
      reserve: BORROW_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '500',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 8500,
      crossReservePositions: crpA,
    });

    // Scenario B: delta borrow = $2000 (exceeds cap of $1000, gets capped to $1000)
    // totalBorrowUsd = 8000 + 2000 = 10000
    // rawBorrowInputUsd = 2000, borrowInputUsd = 1000 (CAPPED)
    // BUG: walletBorrowUsd = 10000 - 1000 = 9000 ❌ (should be 8000)
    // FIX: walletBorrowUsd = 10000 - 2000 = 8000 ✓
    const crpB = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 5000, borrowUsd: 8000 }]]);
    const rB = buildRateSimulationResult({
      reserve: BORROW_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '2000',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 5000,
      totalBorrowUsd: 10000,
      crossReservePositions: crpB,
    });

    // Both scenarios have the same wallet (supply=5000, borrow=8000).
    // currentIncentive must be the same — it represents the wallet's present state.
    // With the bug, walletBorrowUsd differs (8000 vs 9000), changing eligibility ratio:
    //   Correct: net=3000, ratio=3000/8000=0.375
    //   Bug:     net=4000, ratio=4000/9000≈0.444
    expect(rB.borrow.currentIncentive).toBeCloseTo(rA.borrow.currentIncentive, 6);
  });

  it('supply currentIncentive is same whether delta is under or over supply cap (same wallet)', () => {
    // Wallet: supply=$8000, borrow=$5000
    // Reserve has supply cap = 1000, so supply delta gets capped.

    const SUPPLY_CAP_RESERVE: ReserveWithSpread = {
      ...BASE_RESERVE,
      borrowed: '0',
      supplied: '0',
      liquidity: '10000000000000000000000', // 10000
      supplyCap: '1000000000000000000000', // 1000 — small cap to trigger capping
      borrowCap: '10000000000000000000000', // 10000 — plenty
      merklSupplys: [{
        name: 'Net lending supply group',
        breakdowns: [{
          campaignApr: 10,
          campaignStartedAt: '2020-01-01T00:00:00.000Z',
          campaignEndedAt: '2099-01-01T00:00:00.000Z',
          campaignId: 'aav1120-supply-1',
        }],
        opportunityId: '1120s',
        netPositionConstraint: {
          sourceSide: 'supply',
          offsetReserveIds: [BASE_RESERVE.reserveId],
        },
      }],
    };

    // Scenario A: delta supply = $500 (under cap of $1000)
    // totalSupplyUsd = 8000 + 500 = 8500
    const crpA = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 8000, borrowUsd: 5000 }]]);
    const rA = buildRateSimulationResult({
      reserve: SUPPLY_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 8500,
      totalBorrowUsd: 5000,
      crossReservePositions: crpA,
    });

    // Scenario B: delta supply = $2000 (exceeds cap of $1000, gets capped to $1000)
    // totalSupplyUsd = 8000 + 2000 = 10000
    // rawSupplyInputUsd = 2000, supplyInputUsd = 1000 (CAPPED)
    // BUG: walletSupplyUsd = 10000 - 1000 = 9000 ❌ (should be 8000)
    // FIX: walletSupplyUsd = 10000 - 2000 = 8000 ✓
    const crpB = new Map([[BASE_RESERVE.reserveId, { supplyUsd: 8000, borrowUsd: 5000 }]]);
    const rB = buildRateSimulationResult({
      reserve: SUPPLY_CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '2000',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 10000,
      totalBorrowUsd: 5000,
      crossReservePositions: crpB,
    });

    // Both scenarios have the same wallet (supply=8000, borrow=5000).
    // currentIncentive must be the same.
    expect(rB.supply.currentIncentive).toBeCloseTo(rA.supply.currentIncentive, 6);
  });
});

describe('AAV-1137: walletCrossReservePositions uses wallet-only for all reserves, not just self', () => {
  const OFFSET_RESERVE_ID = '1:0xusde:0xusde';

  const RESERVE_WITH_CROSS_CONSTRAINT: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [
      {
        name: 'Cross-reserve net lending',
        breakdowns: [
          {
            campaignApr: 10,
            campaignStartedAt: '2020-01-01T00:00:00.000Z',
            campaignEndedAt: '2099-01-01T00:00:00.000Z',
            campaignId: 'aav-1137-test',
          },
        ],
        opportunityId: '1137',
        netPositionConstraint: {
          sourceSide: 'supply',
          offsetReserveIds: [OFFSET_RESERVE_ID],
        },
      },
    ],
    merklBorrows: [],
  };

  it('current does NOT change when offset reserve delta changes (walletCrossReservePositions uses wallet-only)', () => {
    const walletCrossReservePositions = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 500 }],
    ]);

    const crpSmallDelta = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 500 }],
    ]);
    const crpLargeDelta = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 800 }],
    ]);

    const r1 = buildRateSimulationResult({
      reserve: RESERVE_WITH_CROSS_CONSTRAINT,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 0,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 0,
      crossReservePositions: crpSmallDelta,
      walletCrossReservePositions,
    });

    const r2 = buildRateSimulationResult({
      reserve: RESERVE_WITH_CROSS_CONSTRAINT,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1000,
      totalBorrowUsd: 0,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 0,
      crossReservePositions: crpLargeDelta,
      walletCrossReservePositions,
    });

    expect(r1.supply.currentIncentive).toBeCloseTo(r2.supply.currentIncentive, 6);

    const walletBorrow = 500;
    const walletSupply = 1000;
    const expectedNetEligible = Math.max(walletSupply - walletBorrow, 0);
    const expectedRatio = expectedNetEligible / walletSupply;
    const expectedCurrent = 10 * expectedRatio;
    expect(r1.supply.currentIncentive).toBeCloseTo(expectedCurrent, 1);
  });

  it('after DOES change when offset reserve delta changes (uses crossReservePositions with total)', () => {
    const walletCrossReservePositions = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 500 }],
    ]);

    const crpSmallDelta = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 500 }],
    ]);
    const crpLargeDelta = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 800 }],
    ]);

    const r1 = buildRateSimulationResult({
      reserve: RESERVE_WITH_CROSS_CONSTRAINT,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1500,
      totalBorrowUsd: 0,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 0,
      crossReservePositions: crpSmallDelta,
      walletCrossReservePositions,
    });

    const r2 = buildRateSimulationResult({
      reserve: RESERVE_WITH_CROSS_CONSTRAINT,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      inputMode: 'usd',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1500,
      totalBorrowUsd: 0,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 0,
      crossReservePositions: crpLargeDelta,
      walletCrossReservePositions,
    });

    expect(r1.supply.afterIncentive).not.toBeCloseTo(r2.supply.afterIncentive, 1);
  });

  it('without walletCrossReservePositions, current=headline (no scaling) — GOLDEN RULE no-wallet case', () => {
    const crossReservePositions = new Map([
      [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 600 }],
    ]);

    const result = buildRateSimulationResult({
      reserve: RESERVE_WITH_CROSS_CONSTRAINT,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      crossReservePositions,
    });

    expect(result.supply.currentIncentive).toBeCloseTo(10.0, 1);
  });
});

describe('AAV-1166: Portfolio Complete Snapshot (portfolioScenarioActive)', () => {
  const makeReserveWithCrossConstraint = (): ReserveWithSpread => ({
    ...BASE_RESERVE,
    reserveId: 'cross-target',
    tokenSymbol: 'USDT',
    supplyIncentives: [],
    borrowIncentives: [],
    meritSupplys: [],
    meritBorrows: [],
    merklSupplys: [{
      name: 'Cross Constraint Test',
      link: 'https://example.com',
      breakdowns: [{
        campaignId: 'cross-test',
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
      }],
      opportunityId: 'cross-opp',
      netPositionConstraint: {
        sourceSide: 'supply',
        offsetReserveIds: ['offset-source'],
      },
    }],
    merklBorrows: [],
    brevisSupplys: [],
    brevisBorrows: [],
  });

  it('portfolioScenarioActive computes afterIncentive for no-local-input member affected by cross-offset', () => {
    // Target reserve has wallet supply but no local input.
    // Offset source has a borrow delta that reduces target's eligible supply.
    const reserve = makeReserveWithCrossConstraint();
    const crossReservePositions = new Map([
      ['offset-source', { supplyUsd: 0, borrowUsd: 500 }],
    ]);
    const walletCrossReservePositions = new Map([
      ['offset-source', { supplyUsd: 0, borrowUsd: 500 }],
    ]);

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0', // no local input on target reserve
      borrowInput: '0',
      forecastStates: {},
      meritMerklNetPosition: true,
      totalSupplyUsd: 1500, // wallet supply = $1500
      walletSupplyUsd: 1500,
      crossReservePositions,
      walletCrossReservePositions,
      portfolioScenarioActive: true,
    });

    expect(result.supply.hasInput).toBe(false);
    // currentIncentive uses wallet-only offset: eligible = 1500 - 500 = 1000 → rate = 10 * 1000/1500
    expect(result.supply.currentIncentive).toBeCloseTo(10 * 1000 / 1500, 6);
    // afterIncentive is non-null because portfolioScenarioActive is true
    expect(result.supply.afterIncentive).not.toBeNull();
    // afterIncentive uses the same crossReservePositions (offset still $500) → same as current
    expect(result.supply.afterIncentive!).toBeCloseTo(result.supply.currentIncentive, 6);
    // delta should be 0 (no change from current in this scenario)
    expect(result.supply.deltaIncentive).toBeCloseTo(0, 6);
    expect(result.supply.sources.merkl?.campaigns?.[0]?.after)
      .toBeCloseTo(result.supply.sources.merkl?.after ?? 0, 6);
  });

  it('portfolioScenarioActive makes afterNative = currentNative when no local input', () => {
    const reserve = makeReserveWithCrossConstraint();

    const result = buildRateSimulationResult({
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1500,
      walletSupplyUsd: 1500,
      portfolioScenarioActive: true,
    });

    expect(result.supply.hasInput).toBe(false);
    expect(result.supply.afterNative).toBe(result.supply.currentNative);
    expect(result.supply.deltaNative).toBe(0);
  });

  it('withdrawal campaign details reconcile with their Merkl source after value', () => {
    const result = buildRateSimulationResult({
      reserve: makeReserveWithCrossConstraint(),
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '-500',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1000,
      walletSupplyUsd: 1500,
      portfolioScenarioActive: true,
    });

    expect(result.supply.sources.merkl?.campaigns?.[0]?.after)
      .toBeCloseTo(result.supply.sources.merkl?.after ?? 0, 6);
  });

  it('currentIncentive unchanged when toggling portfolioScenarioActive (Golden Rule #1)', () => {
    const reserve = makeReserveWithCrossConstraint();
    const baseParams = {
      reserve,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1500,
      walletSupplyUsd: 1500,
      crossReservePositions: new Map([['offset-source', { supplyUsd: 0, borrowUsd: 500 }]]),
      walletCrossReservePositions: new Map([['offset-source', { supplyUsd: 0, borrowUsd: 500 }]]),
    };

    const withoutScenario = buildRateSimulationResult({ ...baseParams, portfolioScenarioActive: false });
    const withScenario = buildRateSimulationResult({ ...baseParams, portfolioScenarioActive: true });

    expect(withScenario.supply.currentIncentive).toBeCloseTo(withoutScenario.supply.currentIncentive, 6);
  });

  it('single-mode reserve with no local input has afterIncentive = null', () => {
    // portfolioScenarioActive only applies to portfolio members; a single-mode reserve
    // with no local input should still have afterIncentive = null.
    // NOTE: the actual non-portfolio vs portfolio-member decision is made by the
    // callers (useSharedRateSimulations / portfolioSimulator) and should be tested there.
    const result = buildRateSimulationResult({
      reserve: makeReserveWithCrossConstraint(),
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      portfolioScenarioActive: false,
    });

    expect(result.supply.afterIncentive).toBeNull();
  });
});

describe('AAV-1177: APR→APY conversion order reconciliation', () => {
  it('Merit campaign detail current matches scale-then-convert (not convert-then-scale)', () => {
    const merits = [
      {
        link: 'https://example.com',
        name: 'Merit Reconcile',
        breakdowns: [
          {
            campaignApr: 20,
            campaignStartedAt: '2024-01-01',
            campaignEndedAt: '2030-12-31',
            campaignId: 'merit-reconcile-1',
          },
        ],
      },
    ];
    const rows = buildMeritCampaignDetails({
      merits,
      isApy: true,
      inputUsd: 1000,
      shouldComputeAfter: false,
      walletEligibilityRatio: 0.5,
    });
    const apr = 20;
    const ratio = 0.5;
    const scaleThenConvert = convertAprToApy(apr * ratio);
    const convertThenScale = convertAprToApy(apr) * ratio;
    expect(rows[0].current).toBeCloseTo(scaleThenConvert, 10);
    expect(rows[0].current).not.toBeCloseTo(convertThenScale, 2);
  });

  it('Merit campaign detail after matches scale-then-convert', () => {
    const merits = [
      {
        link: 'https://example.com',
        name: 'Merit After Reconcile',
        breakdowns: [
          {
            campaignApr: 15,
            campaignStartedAt: '2024-01-01',
            campaignEndedAt: '2030-12-31',
            campaignId: 'merit-after-reconcile-1',
          },
        ],
      },
    ];
    const rows = buildMeritCampaignDetails({
      merits,
      isApy: true,
      inputUsd: 0,
      shouldComputeAfter: true,
      eligibilityRatio: 0.6,
      walletEligibilityRatio: 0.6,
    });
    const apr = 15;
    const ratio = 0.6;
    const scaleThenConvert = convertAprToApy(apr * ratio);
    expect(rows[0].after).toBeCloseTo(scaleThenConvert, 10);
  });

  it('Merkl campaign detail current matches scale-then-convert', () => {
    const opportunities = [
      {
        name: 'Merkl Reconcile',
        link: 'https://example.com',
        breakdowns: [
          {
            campaignId: 'merkl-reconcile-1',
            campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
            campaignApr: 25,
            rewardTokenSymbol: 'USDC',
            campaignStartedAt: '2024-01-01',
            campaignEndedAt: '2030-12-31',
          },
        ],
      },
    ];
    const rows = buildMerklCampaignDetails({
      opportunities,
      isApy: true,
      inputUsd: 0,
      forecastStates: {},
      tydroPointToUsdRate: 1,
      shouldComputeAfter: false,
      walletEligibilityRatio: 0.4,
      walletMerklGroupMultiplier: () => 1,
    });
    const apr = 25;
    const ratio = 0.4;
    const scaleThenConvert = convertAprToApy(apr * ratio);
    const convertThenScale = convertAprToApy(apr) * ratio;
    expect(rows[0].current).toBeCloseTo(scaleThenConvert, 10);
    expect(rows[0].current).not.toBeCloseTo(convertThenScale, 2);
  });
});

describe('AAV-962: BORROW_BL incentive zeroing in simulation', () => {
  const BORROW_BL_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    supplyIncentives: [],
    merklSupplys: [{
      name: 'BORROW_BL supply opp',
      link: 'https://merkl.angle.money',
      breakdowns: [{
        campaignId: 'merkl-borrow-bl-sim',
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
      }],
      opportunityId: 'borrow-bl-1',
      borrowBlacklist: true,
    }],
  };

  it('Shared Scenario: current unchanged (no wallet), after zeroed when borrowInput > 0', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '500',
      forecastStates: {},
    });
    // No wallet → current = headline (not zeroed, no borrow position in wallet)
    expect(result.supply.sources.merkl?.current).toBeCloseTo(10, 1);
    // After = 0 because user simulates borrow → BORROW_BL triggers
    expect(result.supply.sources.merkl?.after).toBeCloseTo(0, 6);
  });

  it('Shared Scenario: neither current nor after zeroed when no borrow input', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
    });
    expect(result.supply.sources.merkl?.current).toBeCloseTo(10, 1);
    expect(result.supply.sources.merkl?.after).toBeCloseTo(10, 1);
  });

  it('Portfolio: current zeroed when wallet has borrow position', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1000,
      totalBorrowUsd: 500,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 500,
    });
    // Wallet has borrow → current zeroed
    expect(result.supply.sources.merkl?.current).toBeCloseTo(0, 6);
    // No simulation input → after is null
    expect(result.supply.afterIncentive).toBeNull();
  });

  it('Portfolio: both current and after zeroed when wallet has borrow + supply input', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1500,
      totalBorrowUsd: 500,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 500,
    });
    // Wallet has borrow → current zeroed
    expect(result.supply.sources.merkl?.current).toBeCloseTo(0, 6);
    // After also zeroed (totalBorrowUsd > 0 from wallet)
    expect(result.supply.sources.merkl?.after).toBeCloseTo(0, 6);
  });

  it('Portfolio: not zeroed when wallet has no borrow position', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1500,
      totalBorrowUsd: 0,
      walletSupplyUsd: 1000,
    });
    // No borrow position → not zeroed
    expect(result.supply.sources.merkl?.current).toBeCloseTo(10, 1);
    expect(result.supply.sources.merkl?.after).toBeCloseTo(10, 1);
  });

  it('Golden Rule: current does NOT change with simulation input (AAV-1121)', () => {
    // Wallet has both supply and borrow → current should be 0 (zeroed)
    // Changing simulation input must not change current
    const baseParams = {
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      forecastStates: {},
      totalSupplyUsd: 1500,
      totalBorrowUsd: 500,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 500,
    };

    const r1 = buildRateSimulationResult({ ...baseParams, supplyInput: '0', borrowInput: '0' });
    const r2 = buildRateSimulationResult({ ...baseParams, supplyInput: '500', borrowInput: '0' });
    const r3 = buildRateSimulationResult({ ...baseParams, supplyInput: '0', borrowInput: '200' });

    // current must be identical across all three
    expect(r1.supply.sources.merkl?.current).toBeCloseTo(r2.supply.sources.merkl?.current ?? -1, 10);
    expect(r1.supply.sources.merkl?.current).toBeCloseTo(r3.supply.sources.merkl?.current ?? -1, 10);
    // And it should be 0 (zeroed because wallet has borrow)
    expect(r1.supply.sources.merkl?.current).toBeCloseTo(0, 6);
  });

  it('per-campaign detail rows also show zeroed current and after', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '500',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1500,
      totalBorrowUsd: 500,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 500,
    });

    const campaigns = result.supply.sources.merkl?.campaigns ?? [];
    expect(campaigns.length).toBe(1);
    expect(campaigns[0].current).toBeCloseTo(0, 6);
    expect(campaigns[0].after).toBeCloseTo(0, 6);
  });

  it('aggregate currentIncentive matches per-source sum when BORROW_BL zeroed', () => {
    const result = buildRateSimulationResult({
      reserve: BORROW_BL_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '0',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1000,
      totalBorrowUsd: 500,
      walletSupplyUsd: 1000,
      walletBorrowUsd: 500,
    });

    const merklCurrent = result.supply.sources.merkl?.current ?? 0;
    const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
    const perSourceSum = protocolCurrent + merklCurrent;
    expect(perSourceSum).toBeCloseTo(result.supply.currentIncentive, 6);
  });
});

describe('AAV-1024: Shared scenario generic offset note', () => {
  const OFFSET_RESERVE_ID = '1:0xoffset:0xoffset';
  const PAIRED_RESERVE_ID = '1:0xpaired:0xpaired';

  const NPC_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    merklSupplys: [{
      name: 'Net lending group',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'npc-shared-test',
      }],
      opportunityId: 'npc-1',
      netPositionConstraint: {
        sourceSide: 'supply',
        offsetReserveIds: [OFFSET_RESERVE_ID],
      },
    }],
  };

  const CAP_RESERVE: ReserveWithSpread = {
    ...BASE_RESERVE,
    merklSupplys: [{
      name: 'Cross-asset pairing group',
      breakdowns: [{
        campaignApr: 10,
        campaignStartedAt: '2020-01-01T00:00:00.000Z',
        campaignEndedAt: '2099-01-01T00:00:00.000Z',
        campaignId: 'cap-shared-test',
      }],
      opportunityId: 'cap-1',
      crossAssetPairing: {
        sourceSide: 'supply',
        pairedReserveId: PAIRED_RESERVE_ID,
        pairedSide: 'supply',
        discountFactor: 0.823,
      },
    }],
  };

  // S1: Reserve has NPC, Shared scenario → no offset; show generic NPC note
  it('S1: NPC reserve in Shared scenario shows generic NPC note', () => {
    const result = buildRateSimulationResult({
      reserve: NPC_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      // No crossReservePositions → Shared scenario
    });

    const merklOffsetNotes = result.supply.sources.merkl?.offsetNotes;
    expect(merklOffsetNotes).toBeDefined();
    expect(merklOffsetNotes!.length).toBeGreaterThan(0);
    const noteText = merklOffsetNotes![0].text;
    expect(noteText).toContain('net position only');
    expect(noteText).toContain('Portfolio mode');
  });

  // S2: Reserve has no NPC/CAP, Shared scenario → no note
  it('S2: Reserve without NPC/CAP in Shared scenario shows no note', () => {
    const result = buildRateSimulationResult({
      reserve: BASE_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
    });

    const merklNotes = result.supply.sources.merkl?.notes;
    expect(merklNotes).toBeUndefined();
  });

  // S13: Reserve has CAP (non-NPC), Shared scenario → no offset; show generic CAP note
  it('S13: CAP reserve in Shared scenario shows generic CAP note', () => {
    const result = buildRateSimulationResult({
      reserve: CAP_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      // No crossReservePositions → Shared scenario
    });

    const merklOffsetNotes = result.supply.sources.merkl?.offsetNotes;
    expect(merklOffsetNotes).toBeDefined();
    expect(merklOffsetNotes!.length).toBeGreaterThan(0);
    const noteText = merklOffsetNotes![0].text;
    expect(noteText).toContain('capped by paired asset');
    expect(noteText).toContain('Portfolio mode');
  });

  // S14: crossReservePositions = undefined vs empty Map → same behavior
  it('S14: NPC reserve with empty Map crossReservePositions shows same generic note as undefined', () => {
    const resultWithEmptyMap = buildRateSimulationResult({
      reserve: NPC_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      crossReservePositions: new Map(),
    });

    const merklOffsetNotes = resultWithEmptyMap.supply.sources.merkl?.offsetNotes;
    expect(merklOffsetNotes).toBeDefined();
    expect(merklOffsetNotes!.length).toBeGreaterThan(0);
    const noteText = merklOffsetNotes![0].text;
    expect(noteText).toContain('net position only');
    expect(noteText).toContain('Portfolio mode');
  });

  // Regression: Portfolio mode with crossReservePositions still shows precise note (S3)
  it('S3 regression: NPC reserve in Portfolio mode shows precise note (not generic)', () => {
    const result = buildRateSimulationResult({
      reserve: NPC_RESERVE,
      reserveRateInput: VALID_RATE_INPUT,
      isApy: false,
      whitelistMerklCampaignIds: undefined,
      tydroPointToUsdRate: 1,
      tokenPrice: 1,
      supplyInput: '1000',
      borrowInput: '0',
      forecastStates: {},
      totalSupplyUsd: 1000,
      crossReservePositions: new Map([
        [OFFSET_RESERVE_ID, { supplyUsd: 0, borrowUsd: 400 }],
      ]),
      reserveSymbolById: new Map([
        [OFFSET_RESERVE_ID, 'USDe'],
        [NPC_RESERVE.reserveId, 'USDC'],
      ]),
    });

    const merklOffsetNotes = result.supply.sources.merkl?.offsetNotes;
    expect(merklOffsetNotes).toBeDefined();
    expect(merklOffsetNotes!.length).toBeGreaterThan(0);
    const noteText = merklOffsetNotes![0].text;
    // Precise note contains dollar amounts and "net eligible"
    expect(noteText).toContain('net eligible');
    expect(noteText).toContain('$');
    // Should NOT contain the generic note text
    expect(noteText).not.toContain('Cross-reserve borrows may reduce');
  });
});
