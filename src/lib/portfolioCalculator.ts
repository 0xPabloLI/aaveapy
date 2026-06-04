/**
 * Portfolio-level aggregation calculator.
 *
 * Takes per-position simulation results and produces a portfolio summary.
 * Individual position simulation is done externally (reusing existing
 * `useRateSimulation` / `buildRateSimulationResult` logic); this module
 * only handles the aggregation layer.
 */

import type {
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSummary,
  PortfolioInputMode,
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

export function resolvePositionAmountUsd(
  position: PortfolioPosition,
  reserve: ReserveWithSpread | undefined
): number {
  const raw = parseNumberInput(position.amount);
  if (raw <= 0) return 0;
  if (position.inputMode === 'usd') return raw;
  const price = reserve?.tokenPrice;
  if (!price || price <= 0) return 0;
  return raw * price;
}

export function buildPortfolioPositionResult(
  position: PortfolioPosition,
  amountUsd: number,
  nativeAprPercent: number,
  incentiveAprPercent: number
): PortfolioPositionResult {
  const totalPercent = nativeAprPercent + incentiveAprPercent;
  const usdPerDay = computePositionUsdPerDay(
    position.side,
    amountUsd,
    nativeAprPercent,
    incentiveAprPercent
  );

  return {
    positionId: position.positionId,
    reserveId: position.reserveId,
    side: position.side,
    amountUsd,
    nativePercent: nativeAprPercent,
    incentivePercent: incentiveAprPercent,
    totalPercent,
    usdPerDay,
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

const MAX_SIGNIFICANT_DIGITS = 8;

export function formatConvertedAmount(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const digits = Math.max(0, MAX_SIGNIFICANT_DIGITS - Math.ceil(Math.log10(abs + 1)));
  const fixed = value.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}
