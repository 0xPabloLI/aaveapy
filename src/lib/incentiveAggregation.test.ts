import { describe, expect, it } from 'vitest';
import { getReserveIncentiveValues, getIncentiveSources, sumBrevisIncentiveApr, sumBrevisIncentiveApy, sumMerklIncentiveApr, sumMerklIncentiveApy } from './incentiveAggregation';
import { convertAprToApy } from '@/lib/rateCalculations';
import type { BrevisIncentive, MerklForecastWireItem, MerklOpportunityGroup, ReserveWithSpread } from '@/types/aave';

const merklPointsReserve = (rewardTokenSymbol?: string): ReserveWithSpread => ({
  reserveId: 'test-1',
  marketName: 'AaveV3Ink',
  chainName: 'Ink',
  chainId: 57073,
  tokenName: 'Test Token',
  tokenSymbol: 'TT',
  tokenAddress: '0x1',
  tokenPrice: 1,
  decimals: 18,
  supplied: '1000000',
  supplyCap: '2000000',
  borrowCap: '1000000',
  utilizationPct: 50,
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
  supplyApy: 5,
  borrowApy: 3,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [{
    name: 'Merkl Test',
    link: 'https://merkl.angle.money',
    breakdowns: [{
      campaignId: 'merkl-test-1',
      campaignApr: 0,
      campaignStartedAt: '2026-01-01',
      campaignEndedAt: '2027-12-31',
      pointsPerThousandUsd: 2,
      rewardTokenSymbol,
    }],
  }],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
});

describe('getReserveIncentiveValues: per-campaign rate routing', () => {
  it('uses pointRateMap rate for known rewardTokenSymbol', () => {
    const reserve = merklPointsReserve('TydroInkPoints');
    const pointRateMap = { tydroinkpoints: 1.5 };
    const result = getReserveIncentiveValues(reserve, 'supply', 1, { pointRateMap });
    expect(result.apr).toBeCloseTo(2 * 1.5 * 36.5, 1);
  });

  it('returns 0 APR for unknown rewardTokenSymbol in pointRateMap', () => {
    const reserve = merklPointsReserve('UnknownPoints');
    const pointRateMap = { tydroinkpoints: 1.5 };
    const result = getReserveIncentiveValues(reserve, 'supply', 1, { pointRateMap });
    expect(result.apr).toBe(0);
  });

  it('returns 0 APR for missing rewardTokenSymbol when pointRateMap is provided', () => {
    const reserve = merklPointsReserve();
    const pointRateMap = { tydroinkpoints: 1.5 };
    const result = getReserveIncentiveValues(reserve, 'supply', 1, { pointRateMap });
    expect(result.apr).toBe(0);
  });

  it('falls back to tydroPointToUsdRate when pointRateMap is not provided', () => {
    const reserve = merklPointsReserve('TydroInkPoints');
    const result = getReserveIncentiveValues(reserve, 'supply', 2.0);
    expect(result.apr).toBeCloseTo(2 * 2.0 * 36.5, 1);
  });
});

describe('getIncentiveSources', () => {
  const makeReserve = (overrides?: Partial<ReserveWithSpread>): ReserveWithSpread => ({
    reserveId: 'test-1',
    marketName: 'AaveV3Ink',
    chainName: 'Ink',
    chainId: 57073,
    tokenName: 'Test Token',
    tokenSymbol: 'TT',
    tokenAddress: '0x1',
    tokenPrice: 1,
    decimals: 18,
    supplied: '1000000',
    supplyCap: '2000000',
    borrowCap: '1000000',
    utilizationPct: 50,
    optimalUtilization: 80,
    slopeBelowOptimal: 4,
    slopeAboveOptimal: 60,
    baseBorrowRate: 0,
    protocolFee: 10,
    supplyApy: 5,
    borrowApy: 3,
    supplyDisabled: false,
    borrowDisabled: false,
    supplyIncentives: [1, 2],
    borrowIncentives: [3],
    meritSupplys: [{ message: { action: 'test', text: 'test' }, breakdowns: [] }],
    meritBorrows: [],
    merklSupplys: [],
    merklBorrows: [{ name: 'Merkl Borrow', link: '', breakdowns: [] }],
    brevisSupplys: [],
    brevisBorrows: [],
    ...overrides,
  });

  it('returns supply-side incentive sources', () => {
    const reserve = makeReserve();
    const sources = getIncentiveSources(reserve, 'supply');
    expect(sources.protocol).toEqual([1, 2]);
    expect(sources.merit).toEqual(reserve.meritSupplys);
    expect(sources.merkl).toEqual(reserve.merklSupplys);
    expect(sources.brevis).toEqual(reserve.brevisSupplys);
  });

  it('returns borrow-side incentive sources', () => {
    const reserve = makeReserve();
    const sources = getIncentiveSources(reserve, 'borrow');
    expect(sources.protocol).toEqual([3]);
    expect(sources.merit).toEqual(reserve.meritBorrows);
    expect(sources.merkl).toEqual(reserve.merklBorrows);
    expect(sources.brevis).toEqual(reserve.brevisBorrows);
  });

  it('returns undefined arrays when reserve fields are missing', () => {
    const reserve = makeReserve({
      supplyIncentives: undefined,
      meritSupplys: undefined,
      merklSupplys: undefined,
      brevisSupplys: undefined,
    });
    const sources = getIncentiveSources(reserve, 'supply');
    expect(sources.protocol).toBeUndefined();
    expect(sources.merit).toBeUndefined();
    expect(sources.merkl).toBeUndefined();
    expect(sources.brevis).toBeUndefined();
  });
});

const makeBrevis = (overrides: Partial<BrevisIncentive> = {}): BrevisIncentive => ({
  link: 'https://example.com/brevis',
  name: 'Brevis USDC',
  campaignApr: 2.5,
  campaignStartedAt: '2026-01-01T00:00:00.000Z',
  campaignEndedAt: '2027-12-31T00:00:00.000Z',
  message: 'Brevis campaign',
  ...overrides,
});

const makeForecastStates = (campaignId: string, overrides: Partial<MerklForecastWireItem> = {}): Record<string, MerklForecastWireItem> => ({
  [campaignId]: {
    campaignId,
    distributedSoFar: 100,
    endTimestamp: Math.floor(new Date('2027-12-31').getTime() / 1000),
    requiredDaily: 5,
    ...overrides,
  },
});

describe('sumBrevisIncentiveApr', () => {
  it('returns 0 for undefined input', () => {
    expect(sumBrevisIncentiveApr()).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(sumBrevisIncentiveApr([])).toBe(0);
  });

  it('returns sum of active campaign APRs without forecastStates', () => {
    const brevis = [
      makeBrevis({ campaignApr: 2.5 }),
      makeBrevis({ campaignApr: 1.5 }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBeCloseTo(4.0, 6);
  });

  it('uses forecastMerklApr when forecastStates is provided', () => {
    const brevis = [
      makeBrevis({ campaignId: 'brevis-1', campaignApr: 0, campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE', aprCap: 5, latestTvl: 100_000, totalBudget: 500 }),
    ];
    const forecastStates = makeForecastStates('brevis-1');
    const withForecast = sumBrevisIncentiveApr(brevis, forecastStates);
    const withoutForecast = sumBrevisIncentiveApr(brevis);
    expect(withForecast).toBeGreaterThan(0);
    expect(withoutForecast).toBe(0);
  });

  it('excludes inactive campaigns', () => {
    const brevis = [
      makeBrevis({ campaignApr: 2.5, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2026-01-31T00:00:00.000Z' }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBe(0);
  });

  it('includes open-ended campaigns (no end date)', () => {
    const brevis = [
      makeBrevis({ campaignApr: 3.0, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: undefined }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBe(3.0);
  });

  it('filters negative APR to 0', () => {
    const brevis = [
      makeBrevis({ campaignApr: -1.5 }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBe(0);
  });

  it('filters NaN APR to 0', () => {
    const brevis = [
      makeBrevis({ campaignApr: NaN }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBe(0);
  });

  it('sums multiple groups with multiple breakdowns', () => {
    const brevis = [
      makeBrevis({ campaignApr: 2.0, breakdowns: [{ campaignId: 'brevis-b1', campaignApr: 1.2, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2027-12-31T00:00:00.000Z' }, { campaignId: 'brevis-b2', campaignApr: 0.8, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2027-12-31T00:00:00.000Z' }] }),
      makeBrevis({ campaignApr: 1.5 }),
    ];
    expect(sumBrevisIncentiveApr(brevis)).toBeCloseTo(3.5, 6);
  });

  it('falls back to campaignApr when forecastStates has no matching campaignId', () => {
    const brevis = [
      makeBrevis({ campaignId: 'brevis-1', campaignApr: 2.5 }),
    ];
    const forecastStates = makeForecastStates('other-campaign');
    expect(sumBrevisIncentiveApr(brevis, forecastStates)).toBeCloseTo(2.5, 6);
  });
});

describe('sumBrevisIncentiveApy', () => {
  it('returns 0 for undefined input', () => {
    expect(sumBrevisIncentiveApy()).toBe(0);
  });

  it('converts each campaign APR to APY before summing', () => {
    const brevis = [
      makeBrevis({ campaignApr: 2.5 }),
    ];
    const apr = sumBrevisIncentiveApr(brevis);
    const apy = sumBrevisIncentiveApy(brevis);
    expect(apy).toBeCloseTo(convertAprToApy(2.5), 6);
    expect(apy).toBeGreaterThan(apr);
  });

  it('excludes inactive campaigns', () => {
    const brevis = [
      makeBrevis({ campaignApr: 2.5, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2026-01-31T00:00:00.000Z' }),
    ];
    expect(sumBrevisIncentiveApy(brevis)).toBe(0);
  });

  it('includes open-ended campaigns', () => {
    const brevis = [
      makeBrevis({ campaignApr: 3.0, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: undefined }),
    ];
    expect(sumBrevisIncentiveApy(brevis)).toBeCloseTo(convertAprToApy(3.0), 6);
  });

  it('filters negative APR to 0', () => {
    const brevis = [
      makeBrevis({ campaignApr: -1.5 }),
    ];
    expect(sumBrevisIncentiveApy(brevis)).toBe(0);
  });

  it('filters NaN APR to 0', () => {
    const brevis = [
      makeBrevis({ campaignApr: NaN }),
    ];
    expect(sumBrevisIncentiveApy(brevis)).toBe(0);
  });

  it('uses forecastStates when provided', () => {
    const brevis = [
      makeBrevis({ campaignId: 'brevis-1', campaignApr: 0, campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE', aprCap: 5, latestTvl: 100_000, totalBudget: 500 }),
    ];
    const forecastStates = makeForecastStates('brevis-1');
    const withForecast = sumBrevisIncentiveApy(brevis, forecastStates);
    const withoutForecast = sumBrevisIncentiveApy(brevis);
    expect(withForecast).toBeGreaterThan(0);
    expect(withoutForecast).toBe(0);
  });
});

const makeMerklOpportunity = (overrides: Partial<MerklOpportunityGroup> = {}): MerklOpportunityGroup => ({
  name: 'Merkl Test',
  link: 'https://merkl.angle.money',
  breakdowns: [{
    campaignId: 'merkl-test-1',
    campaignApr: 3.0,
    campaignStartedAt: '2026-01-01',
    campaignEndedAt: '2027-12-31',
  }],
  ...overrides,
});

const makeMerklPointsOpportunity = (rewardTokenSymbol?: string, pointsPerThousandUsd = 2): MerklOpportunityGroup => ({
  name: 'Merkl Points Test',
  link: 'https://merkl.angle.money',
  breakdowns: [{
    campaignId: 'merkl-pts-1',
    campaignApr: 0,
    campaignStartedAt: '2026-01-01',
    campaignEndedAt: '2027-12-31',
    pointsPerThousandUsd,
    rewardTokenSymbol,
  }],
});

describe('sumMerklIncentiveApr', () => {
  it('returns 0 for undefined input', () => {
    expect(sumMerklIncentiveApr()).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(sumMerklIncentiveApr([])).toBe(0);
  });

  it('sums active campaign APRs', () => {
    const opportunities = [
      makeMerklOpportunity(),
      makeMerklOpportunity({ breakdowns: [{ campaignId: 'merkl-test-2', campaignApr: 1.5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31' }] }),
    ];
    expect(sumMerklIncentiveApr(opportunities)).toBeCloseTo(4.5, 6);
  });

  it('applies groupMultiplier', () => {
    const opportunities = [makeMerklOpportunity()];
    const result = sumMerklIncentiveApr(opportunities, 1, { merklGroupMultiplier: () => 0.5 });
    expect(result).toBeCloseTo(1.5, 6);
  });

  it('applies groupMultiplier per group', () => {
    const opportunities = [
      makeMerklOpportunity({ name: 'opp-1' }),
      makeMerklOpportunity({ name: 'opp-2', breakdowns: [{ campaignId: 'merkl-test-2', campaignApr: 2.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31' }] }),
    ];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      merklGroupMultiplier: (group) => group.name === 'opp-1' ? 2 : 1,
    });
    expect(result).toBeCloseTo(3.0 * 2 + 2.0, 6);
  });

  it('uses pointRateMap for per-symbol rate routing', () => {
    const opportunities = [makeMerklPointsOpportunity('TydroInkPoints', 2)];
    const pointRateMap = { tydroinkpoints: 1.5 };
    const result = sumMerklIncentiveApr(opportunities, 1, { pointRateMap });
    expect(result).toBeCloseTo(2 * 1.5 * 36.5, 1);
  });

  it('returns 0 APR when rewardTokenSymbol not in pointRateMap', () => {
    const opportunities = [makeMerklPointsOpportunity('UnknownPoints', 2)];
    const pointRateMap = { tydroinkpoints: 1.5 };
    const result = sumMerklIncentiveApr(opportunities, 1, { pointRateMap });
    expect(result).toBe(0);
  });

  it('falls back to tydroPointToUsdRate when pointRateMap is not provided', () => {
    const opportunities = [makeMerklPointsOpportunity('TydroInkPoints', 2)];
    const result = sumMerklIncentiveApr(opportunities, 2.0);
    expect(result).toBeCloseTo(2 * 2.0 * 36.5, 1);
  });

  it('excludes inactive campaigns', () => {
    const opportunities = [makeMerklOpportunity({
      breakdowns: [{ campaignId: 'merkl-ended', campaignApr: 3.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2026-01-31' }],
    })];
    expect(sumMerklIncentiveApr(opportunities)).toBe(0);
  });
});

describe('sumMerklIncentiveApy', () => {
  it('returns 0 for undefined input', () => {
    expect(sumMerklIncentiveApy()).toBe(0);
  });

  it('converts APR to APY before summing', () => {
    const opportunities = [makeMerklOpportunity()];
    const apr = sumMerklIncentiveApr(opportunities);
    const apy = sumMerklIncentiveApy(opportunities);
    expect(apy).toBeCloseTo(convertAprToApy(3.0), 6);
    expect(apy).toBeGreaterThan(apr);
  });

  it('applies groupMultiplier to APY result', () => {
    const opportunities = [makeMerklOpportunity()];
    const result = sumMerklIncentiveApy(opportunities, 1, { merklGroupMultiplier: () => 0.5 });
    expect(result).toBeCloseTo(convertAprToApy(3.0) * 0.5, 6);
  });

  it('excludes inactive campaigns', () => {
    const opportunities = [makeMerklOpportunity({
      breakdowns: [{ campaignId: 'merkl-ended', campaignApr: 3.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2026-01-31' }],
    })];
    expect(sumMerklIncentiveApy(opportunities)).toBe(0);
  });
});

describe('sumMerklIncentiveApr — positionCapUsd', () => {
  const makeCappedMerklOpp = (positionCapUsd?: number) => makeMerklOpportunity({
    breakdowns: [{
      campaignId: 'capped-merkl',
      campaignApr: 10,
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2030-12-31',
      ...(positionCapUsd != null ? { positionCapUsd } : {}),
    }],
  });

  it('applies position cap dilution when positionUsd > positionCapUsd', () => {
    const opportunities = [makeCappedMerklOpp(500)];
    const result = sumMerklIncentiveApr(opportunities, 1, { positionUsd: 1000 });
    expect(result).toBeLessThan(10);
    expect(result).toBeCloseTo(10 * (500 / 1000), 6);
  });

  it('does not dilute when positionUsd <= positionCapUsd', () => {
    const opportunities = [makeCappedMerklOpp(2000)];
    const result = sumMerklIncentiveApr(opportunities, 1, { positionUsd: 1000 });
    expect(result).toBeCloseTo(10, 6);
  });

  it('does not dilute when positionUsd is not provided', () => {
    const opportunities = [makeCappedMerklOpp(500)];
    const result = sumMerklIncentiveApr(opportunities, 1);
    expect(result).toBeCloseTo(10, 6);
  });

  it('does not dilute when breakdown has no positionCapUsd', () => {
    const opportunities = [makeCappedMerklOpp()];
    const result = sumMerklIncentiveApr(opportunities, 1, { positionUsd: 1000 });
    expect(result).toBeCloseTo(10, 6);
  });
});

describe('sumMerklIncentiveApr — positionCapNative path', () => {
  const makeNativeCappedMerklOpp = (positionCapNative: string) => makeMerklOpportunity({
    breakdowns: [{
      campaignId: 'capped-merkl-native',
      campaignApr: 10,
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2030-12-31',
      positionCapNative,
    }],
  });

  it('converts positionCapNative to USD and applies dilution', () => {
    const opportunities = [makeNativeCappedMerklOpp('500000000')];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      tokenPrice: 1,
      decimals: 6,
    });
    expect(result).toBeCloseTo(10 * (500 / 1000), 6);
  });

  it('falls back to DEFAULT_TOKEN_DECIMALS when decimals undefined', () => {
    const opportunities = [makeNativeCappedMerklOpp('500000000000000000000')];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      tokenPrice: 1,
    });
    expect(result).toBeCloseTo(10 * (500 / 1000), 6);
  });

  it('prefers positionCapNative over positionCapUsd when both present', () => {
    const opportunities = [makeMerklOpportunity({
      breakdowns: [{
        campaignId: 'capped-both',
        campaignApr: 10,
        campaignStartedAt: '2025-01-01',
        campaignEndedAt: '2030-12-31',
        positionCapNative: '500000000',
        positionCapUsd: 9999,
      }],
    })];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      tokenPrice: 1,
      decimals: 6,
    });
    expect(result).toBeCloseTo(10 * (500 / 1000), 6);
  });

  it('skips conversion when tokenPrice missing and no positionCapUsd fallback', () => {
    const opportunities = [makeNativeCappedMerklOpp('500000000')];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      decimals: 6,
    });
    expect(result).toBeCloseTo(10, 6);
  });
});

describe('sumMerklIncentiveApr — unified eligibility (cap + offset composition)', () => {
  const makeCappedOpp = (capUsd?: number) => makeMerklOpportunity({
    breakdowns: [{
      campaignId: 'unified-elig-merkl',
      campaignApr: 10,
      campaignStartedAt: '2025-01-01',
      campaignEndedAt: '2030-12-31',
      ...(capUsd != null ? { positionCapUsd: capUsd } : {}),
    }],
  });

  it('composes position cap and cross-reserve offset as single eligible principal (no double-scaling)', () => {
    // grossPosition = 1500, cap = 1000, netEligible = 1000 (offset = 500)
    // correct: 10 * min(1000, 1000) / 1500 = 6.667
    // bug: (10 * 1000/1500) * (1000/1500) = 4.444
    const opportunities = [makeCappedOpp(1000)];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1500,
      crossReserveNetEligibleUsd: () => 1000,
    });
    expect(result).toBeCloseTo(10 * 1000 / 1500, 6);
  });

  it('cap only (no offset) — identical to current behavior when crossReserveNetEligibleUsd not provided', () => {
    const opportunities = [makeCappedOpp(500)];
    const withoutUnified = sumMerklIncentiveApr(opportunities, 1, { positionUsd: 1000 });
    const withUnifiedMatching = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      crossReserveNetEligibleUsd: () => 1000, // net = gross, no offset
    });
    expect(withUnifiedMatching).toBeCloseTo(withoutUnified, 6);
    expect(withUnifiedMatching).toBeCloseTo(10 * 500 / 1000, 6);
  });

  it('offset only (no cap) — applies offset as single ratio', () => {
    // grossPosition = 1500, no cap, netEligible = 1000
    // correct: 10 * 1000 / 1500 = 6.667
    const opportunities = [makeCappedOpp()];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1500,
      crossReserveNetEligibleUsd: () => 1000,
    });
    expect(result).toBeCloseTo(10 * 1000 / 1500, 6);
  });

  it('neither cap nor offset — no scaling', () => {
    const opportunities = [makeCappedOpp()];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1500,
      crossReserveNetEligibleUsd: () => 1500, // net = gross, no offset
    });
    expect(result).toBeCloseTo(10, 6);
  });

  it('offset makes net eligible exceed cap — cap is binding', () => {
    // grossPosition = 2000, cap = 1500, netEligible = 1800 (offset = 200)
    // eligible = min(1800, 1500) = 1500
    // correct: 10 * 1500 / 2000 = 7.5
    const opportunities = [makeCappedOpp(1500)];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 2000,
      crossReserveNetEligibleUsd: () => 1800,
    });
    expect(result).toBeCloseTo(10 * 1500 / 2000, 6);
  });

  it('offset makes net eligible below cap — offset is binding', () => {
    // grossPosition = 2000, cap = 1500, netEligible = 1000 (offset = 1000)
    // eligible = min(1000, 1500) = 1000
    // correct: 10 * 1000 / 2000 = 5.0
    const opportunities = [makeCappedOpp(1500)];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 2000,
      crossReserveNetEligibleUsd: () => 1000,
    });
    expect(result).toBeCloseTo(10 * 1000 / 2000, 6);
  });

  it('does not apply merklGroupMultiplier when crossReserveNetEligibleUsd is provided', () => {
    // If groupMultiplier were also applied, result would be double-scaled
    const opportunities = [makeCappedOpp(1000)];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1500,
      crossReserveNetEligibleUsd: () => 1000,
      merklGroupMultiplier: () => 1000 / 1500, // should be ignored
    });
    expect(result).toBeCloseTo(10 * 1000 / 1500, 6);
  });

  it('falls back to merklGroupMultiplier when positionUsd is null (Shared Scenario)', () => {
    // No positionUsd → can't apply unified eligibility → fall back to groupMultiplier for offset
    const opportunities = [makeMerklOpportunity()]; // 3% APR, no cap
    const result = sumMerklIncentiveApr(opportunities, 1, {
      crossReserveNetEligibleUsd: () => 1000,
      merklGroupMultiplier: () => 0.5,
    });
    expect(result).toBeCloseTo(3 * 0.5, 6);
  });
});

describe('AAV-962: BORROW_BL incentive zeroing', () => {
  const makeBorrowBlOpportunity = (overrides: Partial<MerklOpportunityGroup> = {}): MerklOpportunityGroup => ({
    name: 'BORROW_BL Test',
    link: 'https://merkl.angle.money',
    breakdowns: [{
      campaignId: 'merkl-borrow-bl-1',
      campaignApr: 5.0,
      campaignStartedAt: '2026-01-01',
      campaignEndedAt: '2027-12-31',
    }],
    borrowBlacklist: true,
    ...overrides,
  });

  it('sumMerklIncentiveApr returns 0 when merklGroupMultiplier returns 0 for BORROW_BL', () => {
    const opportunities = [makeBorrowBlOpportunity()];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      merklGroupMultiplier: (group) => group.borrowBlacklist ? 0 : 1,
    });
    expect(result).toBe(0);
  });

  it('sumMerklIncentiveApr returns 0 when crossReserveNetEligibleUsd returns 0 for BORROW_BL (unified path)', () => {
    const opportunities = [makeBorrowBlOpportunity()];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      crossReserveNetEligibleUsd: (group) => group.borrowBlacklist ? 0 : 1000,
    });
    expect(result).toBe(0);
  });

  it('sumMerklIncentiveApy returns 0 when merklGroupMultiplier returns 0 for BORROW_BL', () => {
    const opportunities = [makeBorrowBlOpportunity()];
    const result = sumMerklIncentiveApy(opportunities, 1, {
      merklGroupMultiplier: (group) => group.borrowBlacklist ? 0 : 1,
    });
    expect(result).toBe(0);
  });

  it('non-BORROW_BL group is unaffected by the zeroing multiplier', () => {
    const opportunities = [
      makeBorrowBlOpportunity({ name: 'bl-group' }),
      makeMerklOpportunity({ name: 'normal-group' }),
    ];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      merklGroupMultiplier: (group) => group.borrowBlacklist ? 0 : 1,
    });
    // Only the normal group's 3% APR remains
    expect(result).toBeCloseTo(3.0, 6);
  });

  it('non-BORROW_BL group is unaffected by the zeroing crossReserveNetEligibleUsd', () => {
    const opportunities = [
      makeBorrowBlOpportunity({ name: 'bl-group' }),
      makeMerklOpportunity({ name: 'normal-group' }),
    ];
    const result = sumMerklIncentiveApr(opportunities, 1, {
      positionUsd: 1000,
      crossReserveNetEligibleUsd: (group) => group.borrowBlacklist ? 0 : 1000,
    });
    // Only the normal group's 3% APR remains
    expect(result).toBeCloseTo(3.0, 6);
  });
});
