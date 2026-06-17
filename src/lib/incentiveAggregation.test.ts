import { describe, expect, it } from 'vitest';
import { formatForecastUnavailableLabel, getReserveIncentiveValues } from './incentiveAggregation';
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

describe('formatForecastUnavailableLabel', () => {
  it('shows single campaign ID', () => {
    expect(formatForecastUnavailableLabel(['123'], 1))
      .toBe('Campaign #123 without forecast – using current APR.');
  });

  it('shows multiple campaign IDs', () => {
    expect(formatForecastUnavailableLabel(['123', '456'], 2))
      .toBe('Campaigns #123, #456 without forecast – using current APR.');
  });

  it('truncates after 3 with +N more', () => {
    expect(formatForecastUnavailableLabel(['1', '2', '3', '4', '5'], 5))
      .toBe('Campaigns #1, #2, #3 +2 more without forecast – using current APR.');
  });

  it('falls back to count when ids is undefined', () => {
    expect(formatForecastUnavailableLabel(undefined, 3))
      .toBe('3 campaigns without forecast – using current APR.');
  });

  it('falls back to count when ids is empty but count > 0', () => {
    expect(formatForecastUnavailableLabel([], 2))
      .toBe('2 campaigns without forecast – using current APR.');
  });

  it('uses singular "campaign" for count=1', () => {
    expect(formatForecastUnavailableLabel(undefined, 1))
      .toBe('1 campaign without forecast – using current APR.');
  });
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
