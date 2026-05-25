import { describe, it, expect } from 'vitest';
import { sortReserves, compareSupplyOrBorrow, type ReserveSortConfig, type ReserveSortValueGetters } from './reservesSorter';
import type { SortOrder, SortableColumn, SizeSortMode, UtilSortMode, SortMode } from '@/hooks/reserves-table/useReservesTableSort';

interface StubReserve {
  reserveId: string;
  tokenSymbol: string;
  marketName: string;
  tokenPrice: number | undefined;
  reserveSizeUsd: number | null;
  totalBorrowedUsd: number | null;
  availableToBorrowUsd: number | null;
  supplyAvailabilityUsd: number | null;
  deficitRatio: number | null;
  deficitAmount: number | null;
  supplyCapUsd: number | null;
  borrowCapUsd: number | null;
  availableLiquidityUsd: number | null;
  utilization: number | null;
  optimalUtilization: number | undefined;
  displaySupplyTotal: number | null;
  displaySupplyNative: number | null;
  displaySupplyIncentive: number | null;
  supplyHasIncentiveSource: boolean;
  displayBorrowTotal: number | null;
  displayBorrowNative: number | null;
  displayBorrowIncentive: number | null;
  borrowHasIncentiveSource: boolean;
  displaySpread: number | null;
}

const stubValueGetters: ReserveSortValueGetters<StubReserve> = {
  getReserveId: (r) => r.reserveId,
  getTokenSymbol: (r) => r.tokenSymbol,
  getMarketName: (r) => r.marketName,
  getTokenPrice: (r) => r.tokenPrice,
  getReserveSizeUsd: (r) => r.reserveSizeUsd,
  getTotalBorrowedUsd: (r) => r.totalBorrowedUsd,
  getAvailableToBorrowUsd: (r) => r.availableToBorrowUsd,
  getSupplyAvailabilityUsd: (r) => r.supplyAvailabilityUsd,
  getDeficitRatio: (r) => r.deficitRatio,
  getDeficitAmount: (r) => r.deficitAmount,
  getSupplyCapUsd: (r) => r.supplyCapUsd,
  getBorrowCapUsd: (r) => r.borrowCapUsd,
  getAvailableLiquidityUsd: (r) => r.availableLiquidityUsd,
  getUtilization: (r) => r.utilization,
  getOptimalUtilization: (r) => r.optimalUtilization,
  getDisplaySupplyTotal: (r) => r.displaySupplyTotal,
  getDisplaySupplyNative: (r) => r.displaySupplyNative,
  getDisplaySupplyIncentive: (r) => r.displaySupplyIncentive,
  hasSupplyIncentiveSource: (r) => r.supplyHasIncentiveSource,
  getDisplayBorrowTotal: (r) => r.displayBorrowTotal,
  getDisplayBorrowNative: (r) => r.displayBorrowNative,
  getDisplayBorrowIncentive: (r) => r.displayBorrowIncentive,
  hasBorrowIncentiveSource: (r) => r.borrowHasIncentiveSource,
  getDisplaySpread: (r) => r.displaySpread,
};

function makeConfig(overrides: Partial<ReserveSortConfig> = {}): ReserveSortConfig {
  return {
    activeSortColumn: 'supply',
    tokenSortOrder: 'asc',
    marketSortOrder: 'asc',
    priceSortOrder: 'desc',
    sizeSortMode: 'supply',
    sizeSortOrder: 'desc',
    utilSortMode: 'util',
    utilSortOrder: 'desc',
    supplySortMode: 'total',
    supplySortOrder: 'desc',
    borrowSortMode: 'total',
    borrowSortOrder: 'desc',
    spreadSortOrder: 'desc',
    ...overrides,
  };
}

function stub(overrides: Partial<StubReserve> = {}): StubReserve {
  return {
    reserveId: 'r1',
    tokenSymbol: 'USDC',
    marketName: 'Ethereum',
    tokenPrice: 1,
    reserveSizeUsd: 1_000_000,
    totalBorrowedUsd: 500_000,
    availableToBorrowUsd: 200_000,
    supplyAvailabilityUsd: 300_000,
    deficitRatio: null,
    deficitAmount: null,
    supplyCapUsd: 2_000_000,
    borrowCapUsd: 1_000_000,
    availableLiquidityUsd: 500_000,
    utilization: 50,
    optimalUtilization: undefined,
    displaySupplyTotal: 5,
    displaySupplyNative: 3,
    displaySupplyIncentive: 2,
    supplyHasIncentiveSource: true,
    displayBorrowTotal: 3,
    displayBorrowNative: 2,
    displayBorrowIncentive: 1,
    borrowHasIncentiveSource: true,
    displaySpread: 2,
    ...overrides,
  };
}

describe('sortReserves', () => {
  describe('token sort', () => {
    it('sorts by token symbol ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', tokenSymbol: 'WBTC' }),
        stub({ reserveId: 'r2', tokenSymbol: 'AAVE' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'token', tokenSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
      expect(result[1].reserveId).toBe('r1');
    });

    it('sorts by token symbol descending', () => {
      const reserves = [
        stub({ reserveId: 'r1', tokenSymbol: 'AAVE' }),
        stub({ reserveId: 'r2', tokenSymbol: 'WBTC' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'token', tokenSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
      expect(result[1].reserveId).toBe('r1');
    });

    it('tiebreaks by market name then reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', tokenSymbol: 'USDC', marketName: 'Polygon' }),
        stub({ reserveId: 'r1', tokenSymbol: 'USDC', marketName: 'Ethereum' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'token', tokenSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
      expect(result[1].reserveId).toBe('r2');
    });
  });

  describe('market sort', () => {
    it('sorts by market name ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', marketName: 'Polygon' }),
        stub({ reserveId: 'r2', marketName: 'Arbitrum' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'market', marketSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by token then reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', marketName: 'Ethereum', tokenSymbol: 'WBTC' }),
        stub({ reserveId: 'r1', marketName: 'Ethereum', tokenSymbol: 'AAVE' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'market', marketSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('price sort', () => {
    it('sorts by price descending', () => {
      const reserves = [
        stub({ reserveId: 'r1', tokenPrice: 1 }),
        stub({ reserveId: 'r2', tokenPrice: 40000 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'price', priceSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('null price sorts last in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', tokenPrice: undefined }),
        stub({ reserveId: 'r2', tokenPrice: 100 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'price', priceSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', tokenPrice: 100 }),
        stub({ reserveId: 'r1', tokenPrice: 100 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'price', priceSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('size sort', () => {
    it('sorts by supply size desc (default mode)', () => {
      const reserves = [
        stub({ reserveId: 'r1', reserveSizeUsd: 100 }),
        stub({ reserveId: 'r2', reserveSizeUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supply', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by borrow size desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', totalBorrowedUsd: 100 }),
        stub({ reserveId: 'r2', totalBorrowedUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'borrow', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by supplyCapValue desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', supplyCapUsd: 1_000_000 }),
        stub({ reserveId: 'r2', supplyCapUsd: 5_000_000 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supplyCapValue', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by borrowCapValue desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', borrowCapUsd: 500_000 }),
        stub({ reserveId: 'r2', borrowCapUsd: 2_000_000 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'borrowCapValue', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by availableLiquidity desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', availableLiquidityUsd: 100 }),
        stub({ reserveId: 'r2', availableLiquidityUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'availableLiquidity', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by deficitRatio desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', deficitRatio: 0.1 }),
        stub({ reserveId: 'r2', deficitRatio: 0.5 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'deficitRatio', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by deficitAmount desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', deficitAmount: 100 }),
        stub({ reserveId: 'r2', deficitAmount: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'deficitAmount', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by supplyCapPct using compareSizeToCapPct', () => {
      const reserves = [
        stub({ reserveId: 'r1', reserveSizeUsd: 50, supplyCapUsd: 100 }),
        stub({ reserveId: 'r2', reserveSizeUsd: 90, supplyCapUsd: 100 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supplyCapPct', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('null values sort last in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', reserveSizeUsd: null }),
        stub({ reserveId: 'r2', reserveSizeUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supply', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', reserveSizeUsd: 100 }),
        stub({ reserveId: 'r1', reserveSizeUsd: 100 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supply', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('util sort', () => {
    it('sorts by utilization desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', utilization: 30 }),
        stub({ reserveId: 'r2', utilization: 80 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'util', utilSortMode: 'util', utilSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by optimal util desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', optimalUtilization: 50 }),
        stub({ reserveId: 'r2', optimalUtilization: 80 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'util', utilSortMode: 'optimal', utilSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by liquidity desc (uses availableLiquidityUsd)', () => {
      const reserves = [
        stub({ reserveId: 'r1', availableLiquidityUsd: 100 }),
        stub({ reserveId: 'r2', availableLiquidityUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'util', utilSortMode: 'liquidity', utilSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', utilization: 50 }),
        stub({ reserveId: 'r1', utilization: 50 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'util', utilSortMode: 'util', utilSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('supply sort', () => {
    it('sorts by total supply desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyTotal: 3 }),
        stub({ reserveId: 'r2', displaySupplyTotal: 8 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'total', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by native supply desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyNative: 1 }),
        stub({ reserveId: 'r2', displaySupplyNative: 5 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'native', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('null total sorts last in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyTotal: null }),
        stub({ reserveId: 'r2', displaySupplyTotal: 5 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'total', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', displaySupplyTotal: 5 }),
        stub({ reserveId: 'r1', displaySupplyTotal: 5 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'total', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('borrow sort', () => {
    it('sorts by total borrow desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displayBorrowTotal: 2 }),
        stub({ reserveId: 'r2', displayBorrowTotal: 7 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'borrow', borrowSortMode: 'total', borrowSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by native borrow desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displayBorrowNative: 1 }),
        stub({ reserveId: 'r2', displayBorrowNative: 4 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'borrow', borrowSortMode: 'native', borrowSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('null total sorts last in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displayBorrowTotal: null }),
        stub({ reserveId: 'r2', displayBorrowTotal: 3 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'borrow', borrowSortMode: 'total', borrowSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('spread sort', () => {
    it('sorts by spread desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySpread: 1 }),
        stub({ reserveId: 'r2', displaySpread: 5 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'spread', spreadSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('null spread sorts last in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySpread: null }),
        stub({ reserveId: 'r2', displaySpread: 2 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'spread', spreadSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', displaySpread: 2 }),
        stub({ reserveId: 'r1', displaySpread: 2 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'spread', spreadSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('default sort (null activeSortColumn)', () => {
    it('defaults to supply total desc when no column is selected', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyTotal: 3 }),
        stub({ reserveId: 'r2', displaySupplyTotal: 8 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: null, supplySortMode: 'total', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('incentive sort with source priority', () => {
    it('reserves with incentive source sort ahead of those without', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyIncentive: 0, displaySupplyNative: 5, supplyHasIncentiveSource: false }),
        stub({ reserveId: 'r2', displaySupplyIncentive: 0, displaySupplyNative: 1, supplyHasIncentiveSource: true }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'incentive', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('market sort desc', () => {
    it('sorts by market name descending', () => {
      const reserves = [
        stub({ reserveId: 'r1', marketName: 'Arbitrum' }),
        stub({ reserveId: 'r2', marketName: 'Polygon' }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'market', marketSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('price sort asc', () => {
    it('sorts by price ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', tokenPrice: 40000 }),
        stub({ reserveId: 'r2', tokenPrice: 1 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'price', priceSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('size sort extended modes', () => {
    it('sorts by borrowAvailability desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', availableToBorrowUsd: 100 }),
        stub({ reserveId: 'r2', availableToBorrowUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'borrowAvailability', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by supplyAvailability desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', supplyAvailabilityUsd: 100 }),
        stub({ reserveId: 'r2', supplyAvailabilityUsd: 500 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'supplyAvailability', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('sorts by borrowCapPct using compareSizeToCapPct', () => {
      const reserves = [
        stub({ reserveId: 'r1', totalBorrowedUsd: 50, borrowCapUsd: 100 }),
        stub({ reserveId: 'r2', totalBorrowedUsd: 90, borrowCapUsd: 100 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'size', sizeSortMode: 'borrowCapPct', sizeSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('util sort asc', () => {
    it('sorts by utilization ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', utilization: 80 }),
        stub({ reserveId: 'r2', utilization: 30 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'util', utilSortMode: 'util', utilSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('supply sort asc', () => {
    it('sorts by total supply ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyTotal: 8 }),
        stub({ reserveId: 'r2', displaySupplyTotal: 3 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'total', supplySortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('supply incentive 3-way', () => {
    it('incentive mode: higher incentive sorts first in desc', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySupplyIncentive: 1, displaySupplyNative: 5, supplyHasIncentiveSource: true }),
        stub({ reserveId: 'r2', displaySupplyIncentive: 3, displaySupplyNative: 5, supplyHasIncentiveSource: true }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'supply', supplySortMode: 'incentive', supplySortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('borrow sort extended', () => {
    it('incentive mode: source priority for borrow', () => {
      const reserves = [
        stub({ reserveId: 'r1', displayBorrowIncentive: 0, displayBorrowNative: 5, borrowHasIncentiveSource: false }),
        stub({ reserveId: 'r2', displayBorrowIncentive: 0, displayBorrowNative: 1, borrowHasIncentiveSource: true }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'borrow', borrowSortMode: 'incentive', borrowSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });

    it('tiebreaks by reserveId', () => {
      const reserves = [
        stub({ reserveId: 'r2', displayBorrowTotal: 3 }),
        stub({ reserveId: 'r1', displayBorrowTotal: 3 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'borrow', borrowSortMode: 'total', borrowSortOrder: 'desc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r1');
    });
  });

  describe('spread sort asc', () => {
    it('sorts by spread ascending', () => {
      const reserves = [
        stub({ reserveId: 'r1', displaySpread: 5 }),
        stub({ reserveId: 'r2', displaySpread: 1 }),
      ];
      const result = sortReserves(reserves, makeConfig({ activeSortColumn: 'spread', spreadSortOrder: 'asc' }), stubValueGetters);
      expect(result[0].reserveId).toBe('r2');
    });
  });

  describe('does not mutate input', () => {
    it('returns a new array', () => {
      const reserves = [stub({ reserveId: 'r1' }), stub({ reserveId: 'r2' })];
      const result = sortReserves(reserves, makeConfig(), stubValueGetters);
      expect(result).not.toBe(reserves);
    });
  });

  describe('empty input', () => {
    it('returns empty array for empty input', () => {
      const result = sortReserves([], makeConfig(), stubValueGetters);
      expect(result).toEqual([]);
    });
  });

  describe('compareSupplyOrBorrow (exported)', () => {
    const vg = stubValueGetters;

    it('native mode: null values sort last in desc order', () => {
      const a = stub({ reserveId: 'r1', displaySupplyNative: null });
      const b = stub({ reserveId: 'r2', displaySupplyNative: 5 });
      expect(compareSupplyOrBorrow(a, b, 'native', 'desc', vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal, vg.hasSupplyIncentiveSource, vg)).toBeGreaterThan(0);
    });

    it('native mode: both null falls back to reserveId tiebreaker', () => {
      const a = stub({ reserveId: 'r1', displaySupplyNative: null });
      const b = stub({ reserveId: 'r2', displaySupplyNative: null });
      const result = compareSupplyOrBorrow(a, b, 'native', 'desc', vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal, vg.hasSupplyIncentiveSource, vg);
      expect(result).toBeLessThan(0);
    });

    it('total mode: sorts by total in desc order', () => {
      const a = stub({ reserveId: 'r1', displaySupplyTotal: 3 });
      const b = stub({ reserveId: 'r2', displaySupplyTotal: 7 });
      expect(compareSupplyOrBorrow(a, b, 'total', 'desc', vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal, vg.hasSupplyIncentiveSource, vg)).toBeGreaterThan(0);
    });

    it('total mode: sorts by total in asc order', () => {
      const a = stub({ reserveId: 'r1', displaySupplyTotal: 3 });
      const b = stub({ reserveId: 'r2', displaySupplyTotal: 7 });
      expect(compareSupplyOrBorrow(a, b, 'total', 'asc', vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal, vg.hasSupplyIncentiveSource, vg)).toBeLessThan(0);
    });

    it('incentive mode: delegates to compareIncentiveWithNative', () => {
      const a = stub({ reserveId: 'r1', displaySupplyIncentive: 0, displaySupplyNative: 5, supplyHasIncentiveSource: false });
      const b = stub({ reserveId: 'r2', displaySupplyIncentive: 0, displaySupplyNative: 1, supplyHasIncentiveSource: true });
      expect(compareSupplyOrBorrow(a, b, 'incentive', 'desc', vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal, vg.hasSupplyIncentiveSource, vg)).toBeGreaterThan(0);
    });

    it('works for borrow side with borrow getters', () => {
      const a = stub({ reserveId: 'r1', displayBorrowNative: null });
      const b = stub({ reserveId: 'r2', displayBorrowNative: 5 });
      expect(compareSupplyOrBorrow(a, b, 'native', 'desc', vg.getDisplayBorrowNative, vg.getDisplayBorrowIncentive, vg.getDisplayBorrowTotal, vg.hasBorrowIncentiveSource, vg)).toBeGreaterThan(0);
    });
  });
});
