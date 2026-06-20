import { describe, expect, it } from 'vitest';
import { getReserveIncentiveValues, getIncentiveSources } from './incentiveAggregation';
import type { ReserveWithSpread } from '@/types/aave';

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
