import { describe, expect, it } from 'vitest';
import { getReserveIncentiveValues, getIncentiveSources, sumBrevisIncentiveApr, sumBrevisIncentiveApy } from './incentiveAggregation';
import { convertAprToApy } from '@/lib/rateCalculations';
import type { BrevisIncentive, MerklForecastWireItem, ReserveWithSpread } from '@/types/aave';

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
      makeBrevis({ campaignApr: 2.0, breakdowns: [{ campaignApr: 1.2, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2027-12-31T00:00:00.000Z' }, { campaignApr: 0.8, campaignStartedAt: '2026-01-01T00:00:00.000Z', campaignEndedAt: '2027-12-31T00:00:00.000Z' }] }),
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
