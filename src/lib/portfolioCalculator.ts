/**
 * Portfolio-level aggregation calculator.
 *
 * Takes per-position simulation results and produces a portfolio summary.
 * Individual position simulation is done externally (reusing existing
 * `useRateSimulation` / `buildRateSimulationResult` logic); this module
 * only handles the aggregation layer.
 */

import type {
  PortfolioSideData,
  PortfolioPositionResult,
  PortfolioSummary,
  PortfolioInputMode,
  PortfolioSimulationMetric,
} from '@/types/portfolio';
import type { ReserveWithSpread } from '@/types/aave';
import { parseNumberInput } from '@/lib/numberFormat';

const DAYS_PER_YEAR = 365;

/**
 * Aggregate an array of per-position results into a portfolio summary.
 */
export function aggregatePortfolioSummary(
  results: PortfolioPositionResult[]
): PortfolioSummary {
  let totalSupplyUsd = 0;
  let totalBorrowUsd = 0;
  let supplyUsdPerDay = 0;
  let borrowUsdPerDay = 0;

  let currentTotalSupplyUsd: number | null = null;
  let currentTotalBorrowUsd: number | null = null;
  let currentSupplyUsdPerDay: number | null = null;
  let currentBorrowUsdPerDay: number | null = null;
  let hasAnyMetrics = false;

  for (const r of results) {
    const hasMetric = r.usdPerDayMetric !== undefined;
    if (hasMetric) hasAnyMetrics = true;

    if (r.side === 'supply') {
      totalSupplyUsd += r.amountUsd;
      supplyUsdPerDay += r.usdPerDay;
      if (hasMetric && r.usdPerDayMetric!.current !== null) {
        currentSupplyUsdPerDay = (currentSupplyUsdPerDay ?? 0) + r.usdPerDayMetric!.current;
      }
    } else {
      totalBorrowUsd += r.amountUsd;
      borrowUsdPerDay += r.usdPerDay;
      if (hasMetric && r.usdPerDayMetric!.current !== null) {
        currentBorrowUsdPerDay = (currentBorrowUsdPerDay ?? 0) + r.usdPerDayMetric!.current;
      }
    }

    if (r.totalMetric && r.totalMetric.current !== null) {
      if (r.side === 'supply') {
        currentTotalSupplyUsd = (currentTotalSupplyUsd ?? 0) + r.amountUsd;
      } else {
        currentTotalBorrowUsd = (currentTotalBorrowUsd ?? 0) + r.amountUsd;
      }
    }
  }

  const netUsdPerDay = supplyUsdPerDay + borrowUsdPerDay;

  const netEffectiveApy =
    totalSupplyUsd > 0
      ? (netUsdPerDay * DAYS_PER_YEAR) / totalSupplyUsd * 100
      : 0;

  const buildMetric = (
    currentVal: number | null,
    afterVal: number,
  ): PortfolioSimulationMetric | undefined => {
    if (currentVal === null) return undefined;
    return {
      current: currentVal,
      after: afterVal,
      delta: afterVal - currentVal,
    };
  };

  const currentNetUsdPerDay = currentSupplyUsdPerDay !== null && currentBorrowUsdPerDay !== null
    ? currentSupplyUsdPerDay + currentBorrowUsdPerDay
    : null;
  const currentNetEffectiveApy = currentNetUsdPerDay !== null && currentTotalSupplyUsd !== null && currentTotalSupplyUsd > 0
    ? (currentNetUsdPerDay * DAYS_PER_YEAR) / currentTotalSupplyUsd * 100
    : null;

  return {
    totalSupplyUsd,
    totalBorrowUsd,
    supplyUsdPerDay,
    borrowUsdPerDay,
    netUsdPerDay,
    netEffectiveApy,
    ...(hasAnyMetrics ? {
      totalSupplyUsdMetric: buildMetric(currentTotalSupplyUsd, totalSupplyUsd),
      totalBorrowUsdMetric: buildMetric(currentTotalBorrowUsd, totalBorrowUsd),
      supplyUsdPerDayMetric: buildMetric(currentSupplyUsdPerDay, supplyUsdPerDay),
      borrowUsdPerDayMetric: buildMetric(currentBorrowUsdPerDay, borrowUsdPerDay),
      netUsdPerDayMetric: buildMetric(currentNetUsdPerDay, netUsdPerDay),
      netEffectiveApyMetric: buildMetric(currentNetEffectiveApy, netEffectiveApy),
    } : {}),
  };
}

/**
 * Compute estimated USD/day for a single position given its rate and principal.
 *
 * For supply positions the result is positive (earnings).
 * For borrow positions: native cost is negative, incentive rebate is positive,
 * so total = −(nativeCost) + incentiveRebate.
 */
export function computePositionUsdPerDay(
  side: 'supply' | 'borrow',
  amountUsd: number,
  nativeAprPercent: number,
  incentiveAprPercent: number
): number {
  if (amountUsd <= 0) return 0;
  const nativeDaily = (amountUsd * nativeAprPercent) / 100 / DAYS_PER_YEAR;
  const incentiveDaily = (amountUsd * incentiveAprPercent) / 100 / DAYS_PER_YEAR;

  if (side === 'supply') {
    // Supply: native yield + incentive rebate, both positive
    return nativeDaily + incentiveDaily;
  }
  // Borrow: native is cost (negative), incentive is rebate (positive)
  return -nativeDaily + incentiveDaily;
}

export function resolvePositionAmountUsd(
  sideData: PortfolioSideData,
  reserve: ReserveWithSpread | undefined
): number {
  const raw = parseNumberInput(sideData.amount);
  if (raw <= 0) return 0;
  if (sideData.inputMode === 'usd') return raw;
  const price = reserve?.tokenPrice;
  if (!price || price <= 0) return 0;
  return raw * price;
}

export interface BuildPositionResultMetrics {
  nativeMetric?: PortfolioSimulationMetric;
  incentiveMetric?: PortfolioSimulationMetric;
  totalMetric?: PortfolioSimulationMetric;
  usdPerDayMetric?: PortfolioSimulationMetric;
}

export function buildPortfolioPositionResult(
  reserveId: string,
  side: 'supply' | 'borrow',
  amountUsd: number,
  nativeAprPercent: number,
  incentiveAprPercent: number,
  metrics?: BuildPositionResultMetrics,
): PortfolioPositionResult {
  const totalPercent = nativeAprPercent + incentiveAprPercent;
  const usdPerDay = computePositionUsdPerDay(
    side,
    amountUsd,
    nativeAprPercent,
    incentiveAprPercent
  );

  return {
    reserveId,
    side,
    amountUsd,
    nativePercent: nativeAprPercent,
    incentivePercent: incentiveAprPercent,
    totalPercent,
    usdPerDay,
    nativeMetric: metrics?.nativeMetric,
    incentiveMetric: metrics?.incentiveMetric,
    totalMetric: metrics?.totalMetric,
    usdPerDayMetric: metrics?.usdPerDayMetric,
  };
}

export function convertPortfolioInputAmount(
  amount: number,
  from: PortfolioInputMode,
  to: PortfolioInputMode,
  priceInUsd: number,
): number | null {
  if (from === to) return amount;
  if (!Number.isFinite(amount)) return null;
  if (!Number.isFinite(priceInUsd) || priceInUsd <= 0) return null;
  return from === 'usd' ? amount / priceInUsd : amount * priceInUsd;
}

// Re-exported for back-compat. The canonical implementation lives in
// `./portfolioAmountFormat` — all wallet/import/reset/merge paths must
// route through that helper to guarantee identical 8-sig-digit precision.
export {
  formatPortfolioAmount as formatConvertedAmount,
  MAX_PORTFOLIO_AMOUNT_SIG_DIGITS,
} from './portfolioAmountFormat';

