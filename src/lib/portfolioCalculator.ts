/**
 * Portfolio-level aggregation calculator.
 *
 * Takes per-position simulation results and produces a portfolio summary.
 * Individual position simulation is done externally (reusing existing
 * `useRateSimulation` / `buildRateSimulationResult` logic); this module
 * only handles the aggregation layer.
 */

import type {
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';

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

  for (const r of results) {
    if (r.side === 'supply') {
      totalSupplyUsd += r.amountUsd;
      supplyUsdPerDay += r.usdPerDay; // positive = earnings
    } else {
      totalBorrowUsd += r.amountUsd;
      borrowUsdPerDay += r.usdPerDay; // negative = cost (caller signs it)
    }
  }

  const netUsdPerDay = supplyUsdPerDay + borrowUsdPerDay;

  // Net effective APY based on supply principal
  const netEffectiveApy =
    totalSupplyUsd > 0
      ? (netUsdPerDay * DAYS_PER_YEAR) / totalSupplyUsd * 100
      : 0;

  return {
    totalSupplyUsd,
    totalBorrowUsd,
    supplyUsdPerDay,
    borrowUsdPerDay,
    netUsdPerDay,
    netEffectiveApy,
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
