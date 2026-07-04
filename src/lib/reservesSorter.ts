import type { SortOrder } from './sorters';
import { compareNullableNumbers, compareNumbers, compareSizeToCapPct, compareIncentiveWithNative } from './sorters';

export type { SortOrder } from './sorters';

export type SortMode = 'total' | 'native' | 'incentive';

export type SortableColumn =
  | 'token'
  | 'price'
  | 'market'
  | 'size'
  | 'util'
  | 'supply'
  | 'borrow'
  | 'spread';

export type SizeSortMode =
  | 'supply'
  | 'borrow'
  | 'borrowAvailability'
  | 'supplyAvailability'
  | 'deficitRatio'
  | 'deficitAmount'
  | 'supplyCapPct'
  | 'borrowCapPct'
  | 'supplyCapValue'
  | 'borrowCapValue'
  | 'availableLiquidity';

export type UtilSortMode = 'util' | 'liquidity' | 'optimal';

export interface ReserveSortConfig {
  activeSortColumn: SortableColumn | null;
  tokenSortOrder: SortOrder;
  marketSortOrder: SortOrder;
  priceSortOrder: SortOrder;
  sizeSortMode: SizeSortMode;
  sizeSortOrder: SortOrder;
  utilSortMode: UtilSortMode;
  utilSortOrder: SortOrder;
  supplySortMode: SortMode;
  supplySortOrder: SortOrder;
  borrowSortMode: SortMode;
  borrowSortOrder: SortOrder;
  spreadSortOrder: SortOrder;
}

export interface ReserveSortValueGetters<R> {
  getReserveId: (reserve: R) => string;
  getTokenSymbol: (reserve: R) => string;
  getMarketName: (reserve: R) => string;
  getTokenPrice: (reserve: R) => number | undefined;
  getReserveSizeUsd: (reserve: R) => number | null;
  getTotalBorrowedUsd: (reserve: R) => number | null;
  getAvailableToBorrowUsd: (reserve: R) => number | null;
  getSupplyAvailabilityUsd: (reserve: R) => number | null;
  getDeficitRatio: (reserve: R) => number | null;
  getDeficitAmount: (reserve: R) => number | null;
  getSupplyCapUsd: (reserve: R) => number | null;
  getBorrowCapUsd: (reserve: R) => number | null;
  getAvailableLiquidityUsd: (reserve: R) => number | null;
  getUtilization: (reserve: R) => number | null;
  getOptimalUtilization: (reserve: R) => number | undefined;
  getDisplaySupplyTotal: (reserve: R) => number | null;
  getDisplaySupplyNative: (reserve: R) => number | null;
  getDisplaySupplyIncentive: (reserve: R) => number | null;
  hasSupplyIncentiveSource: (reserve: R) => boolean;
  getDisplayBorrowTotal: (reserve: R) => number | null;
  getDisplayBorrowNative: (reserve: R) => number | null;
  getDisplayBorrowIncentive: (reserve: R) => number | null;
  hasBorrowIncentiveSource: (reserve: R) => boolean;
  getDisplaySpread: (reserve: R) => number | null;
  isSupplyDisabled: (reserve: R) => boolean;
  isBorrowDisabled: (reserve: R) => boolean;
}

function orderMultiplier(order: SortOrder): number {
  return order === 'asc' ? 1 : -1;
}

function compareByToken<R>(
  a: R,
  b: R,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  const m = orderMultiplier(order);
  const byToken = vg.getTokenSymbol(a).localeCompare(vg.getTokenSymbol(b), undefined, { sensitivity: 'base' });
  if (byToken !== 0) return m * byToken;
  const byMarket = vg.getMarketName(a).localeCompare(vg.getMarketName(b), undefined, { sensitivity: 'base' });
  if (byMarket !== 0) return m * byMarket;
  return m * vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

function compareByMarket<R>(
  a: R,
  b: R,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  const m = orderMultiplier(order);
  const byMarket = vg.getMarketName(a).localeCompare(vg.getMarketName(b), undefined, { sensitivity: 'base' });
  if (byMarket !== 0) return m * byMarket;
  const byToken = vg.getTokenSymbol(a).localeCompare(vg.getTokenSymbol(b), undefined, { sensitivity: 'base' });
  if (byToken !== 0) return m * byToken;
  return m * vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

function compareByPrice<R>(
  a: R,
  b: R,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  // null → -Infinity: missing values sort last in desc (preserves original ReservesTable behavior)
  const aP = vg.getTokenPrice(a) ?? -Infinity;
  const bP = vg.getTokenPrice(b) ?? -Infinity;
  const comparison = aP - bP;
  if (comparison !== 0) return order === 'desc' ? -comparison : comparison;
  return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

function compareBySize<R>(
  a: R,
  b: R,
  mode: SizeSortMode,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  // null → -Infinity: missing values sort last in desc (preserves original behavior)
  let comparison: number;

  if (mode === 'borrow') {
    const aT = vg.getTotalBorrowedUsd(a) ?? -Infinity;
    const bT = vg.getTotalBorrowedUsd(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'borrowAvailability') {
    const aT = vg.getAvailableToBorrowUsd(a) ?? -Infinity;
    const bT = vg.getAvailableToBorrowUsd(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'supplyAvailability') {
    const aT = vg.getSupplyAvailabilityUsd(a) ?? -Infinity;
    const bT = vg.getSupplyAvailabilityUsd(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'deficitRatio') {
    const aT = vg.getDeficitRatio(a) ?? -Infinity;
    const bT = vg.getDeficitRatio(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'deficitAmount') {
    const aT = vg.getDeficitAmount(a) ?? -Infinity;
    const bT = vg.getDeficitAmount(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'supplyCapValue') {
    const aT = vg.getSupplyCapUsd(a) ?? -Infinity;
    const bT = vg.getSupplyCapUsd(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'borrowCapValue') {
    const aT = vg.getBorrowCapUsd(a) ?? -Infinity;
    const bT = vg.getBorrowCapUsd(b) ?? -Infinity;
    comparison = aT - bT;
  } else if (mode === 'supplyCapPct') {
    return compareSizeToCapPct(
      vg.getReserveSizeUsd(a), vg.getReserveSizeUsd(b),
      vg.getSupplyCapUsd(a), vg.getSupplyCapUsd(b),
      order,
    );
  } else if (mode === 'borrowCapPct') {
    return compareSizeToCapPct(
      vg.getTotalBorrowedUsd(a), vg.getTotalBorrowedUsd(b),
      vg.getBorrowCapUsd(a), vg.getBorrowCapUsd(b),
      order,
    );
  } else if (mode === 'availableLiquidity') {
    const aL = vg.getAvailableLiquidityUsd(a) ?? -Infinity;
    const bL = vg.getAvailableLiquidityUsd(b) ?? -Infinity;
    comparison = aL - bL;
  } else {
    const aT = vg.getReserveSizeUsd(a) ?? -Infinity;
    const bT = vg.getReserveSizeUsd(b) ?? -Infinity;
    comparison = aT - bT;
  }

  if (comparison !== 0) return order === 'desc' ? -comparison : comparison;
  return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

function compareByUtil<R>(
  a: R,
  b: R,
  mode: UtilSortMode,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  // null → -Infinity: missing values sort last in desc (preserves original behavior)
  let comparison: number;

  if (mode === 'liquidity') {
    const aL = vg.getAvailableLiquidityUsd(a) ?? -Infinity;
    const bL = vg.getAvailableLiquidityUsd(b) ?? -Infinity;
    comparison = aL - bL;
  } else if (mode === 'optimal') {
    const aO = vg.getOptimalUtilization(a) ?? -Infinity;
    const bO = vg.getOptimalUtilization(b) ?? -Infinity;
    comparison = aO - bO;
  } else {
    const aU = vg.getUtilization(a) ?? -Infinity;
    const bU = vg.getUtilization(b) ?? -Infinity;
    comparison = aU - bU;
  }

  if (comparison !== 0) return order === 'desc' ? -comparison : comparison;
  return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

export function compareSupplyOrBorrow<R>(
  a: R,
  b: R,
  sortMode: SortMode,
  order: SortOrder,
  getNative: (r: R) => number | null,
  getIncentive: (r: R) => number | null,
  getTotal: (r: R) => number | null,
  hasIncentiveSource: (r: R) => boolean,
  isDisabled: (r: R) => boolean,
  vg: ReserveSortValueGetters<R>,
): number {
  const aDisabled = isDisabled(a);
  const bDisabled = isDisabled(b);
  if (aDisabled !== bDisabled) {
    return aDisabled ? 1 : -1;
  }
  if (sortMode === 'native') {
    const result = compareNullableNumbers(getNative(a), getNative(b), order);
    if (result !== 0) return result;
    return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
  } else if (sortMode === 'incentive') {
    const result = compareIncentiveWithNative(
      getIncentive(a),
      getIncentive(b),
      getNative(a),
      getNative(b),
      order,
      hasIncentiveSource(a),
      hasIncentiveSource(b),
    );
    if (result !== 0) return result;
    return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
  } else {
    const result = compareNullableNumbers(getTotal(a), getTotal(b), order);
    if (result !== 0) return result;
    return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
  }
}

function compareBySpread<R>(
  a: R,
  b: R,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  const aSupplyDisabled = vg.isSupplyDisabled(a);
  const bSupplyDisabled = vg.isSupplyDisabled(b);
  const aBorrowDisabled = vg.isBorrowDisabled(a);
  const bBorrowDisabled = vg.isBorrowDisabled(b);
  const aDisabled = aSupplyDisabled || aBorrowDisabled;
  const bDisabled = bSupplyDisabled || bBorrowDisabled;
  if (aDisabled !== bDisabled) {
    return aDisabled ? 1 : -1;
  }
  const aSpread = vg.getDisplaySpread(a);
  const bSpread = vg.getDisplaySpread(b);
  const result = compareNullableNumbers(aSpread, bSpread, order);
  if (result !== 0) return result;
  return vg.getReserveId(a).localeCompare(vg.getReserveId(b));
}

export function sortReserves<R>(
  reserves: readonly R[],
  config: ReserveSortConfig,
  valueGetters: ReserveSortValueGetters<R>,
): R[] {
  const vg = valueGetters;
  const sortColumn = config.activeSortColumn ?? 'supply';

  return [...reserves].sort((a, b) => {
    if (sortColumn === 'token') {
      return compareByToken(a, b, config.tokenSortOrder, vg);
    }
    if (sortColumn === 'market') {
      return compareByMarket(a, b, config.marketSortOrder, vg);
    }
    if (sortColumn === 'price') {
      return compareByPrice(a, b, config.priceSortOrder, vg);
    }
    if (sortColumn === 'size') {
      return compareBySize(a, b, config.sizeSortMode, config.sizeSortOrder, vg);
    }
    if (sortColumn === 'util') {
      return compareByUtil(a, b, config.utilSortMode, config.utilSortOrder, vg);
    }
    if (sortColumn === 'supply') {
      return compareSupplyOrBorrow(
        a, b, config.supplySortMode, config.supplySortOrder,
        vg.getDisplaySupplyNative, vg.getDisplaySupplyIncentive, vg.getDisplaySupplyTotal,
        vg.hasSupplyIncentiveSource, vg.isSupplyDisabled, vg,
      );
    }
    if (sortColumn === 'borrow') {
      return compareSupplyOrBorrow(
        a, b, config.borrowSortMode, config.borrowSortOrder,
        vg.getDisplayBorrowNative, vg.getDisplayBorrowIncentive, vg.getDisplayBorrowTotal,
        vg.hasBorrowIncentiveSource, vg.isBorrowDisabled, vg,
      );
    }
    return compareBySpread(a, b, config.spreadSortOrder, vg);
  });
}
