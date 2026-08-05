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
import { annualPercentToDailyFraction } from '@/lib/rateCalculations';

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

  // Weighted APY accumulators: Σ(amountUsd × totalPercent)
  let supplyWeightedSum = 0;
  let borrowWeightedSum = 0;

  for (const r of results) {
    const hasMetric = r.usdPerDayMetric !== undefined;
    if (hasMetric) hasAnyMetrics = true;

    if (r.side === 'supply') {
      totalSupplyUsd += r.amountUsd;
      supplyUsdPerDay += r.usdPerDay;
      supplyWeightedSum += r.amountUsd * r.totalPercent;
      if (hasMetric && r.usdPerDayMetric!.current !== null) {
        currentSupplyUsdPerDay = (currentSupplyUsdPerDay ?? 0) + r.usdPerDayMetric!.current;
      }
    } else {
      totalBorrowUsd += r.amountUsd;
      borrowUsdPerDay += r.usdPerDay;
      borrowWeightedSum += r.amountUsd * r.totalPercent;
      if (hasMetric && r.usdPerDayMetric!.current !== null) {
        currentBorrowUsdPerDay = (currentBorrowUsdPerDay ?? 0) + r.usdPerDayMetric!.current;
      }
    }

    if (r.totalMetric && r.totalMetric.current !== null) {
      if (r.side === 'supply') {
        currentTotalSupplyUsd = (currentTotalSupplyUsd ?? 0) + (r.walletUsd ?? r.amountUsd);
      } else {
        currentTotalBorrowUsd = (currentTotalBorrowUsd ?? 0) + (r.walletUsd ?? r.amountUsd);
      }
    }
  }

  const netUsdPerDay = supplyUsdPerDay + borrowUsdPerDay;

  const netEffectiveApy =
    totalSupplyUsd > 0
      ? (netUsdPerDay * DAYS_PER_YEAR) / totalSupplyUsd * 100
      : 0;

  const supplyWeightedApy = totalSupplyUsd > 0
    ? supplyWeightedSum / totalSupplyUsd
    : 0;
  const borrowWeightedApy = totalBorrowUsd > 0
    ? borrowWeightedSum / totalBorrowUsd
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
    supplyWeightedApy,
    borrowWeightedApy,
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
  incentiveAprPercent: number,
  isApy: boolean = false,
): number {
  if (amountUsd <= 0) return 0;
  const nativeDaily = amountUsd * annualPercentToDailyFraction(nativeAprPercent, isApy);
  const incentiveDaily = amountUsd * annualPercentToDailyFraction(incentiveAprPercent, isApy);

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
  isApy: boolean = false,
  forecastUnavailableCampaignCount?: number,
  walletUsd?: number | null,
  effectiveUsd?: number,
  ltvClampedUsd?: number,
): PortfolioPositionResult {
  const totalPercent = side === 'supply'
    ? nativeAprPercent + incentiveAprPercent
    : nativeAprPercent - incentiveAprPercent;
  const usdPerDay = computePositionUsdPerDay(
    side,
    effectiveUsd ?? amountUsd,
    nativeAprPercent,
    incentiveAprPercent,
    isApy,
  );

  return {
    reserveId,
    side,
    amountUsd,
    walletUsd: walletUsd ?? null,
    nativePercent: nativeAprPercent,
    incentivePercent: incentiveAprPercent,
    totalPercent,
    usdPerDay,
    nativeMetric: metrics?.nativeMetric,
    incentiveMetric: metrics?.incentiveMetric,
    totalMetric: metrics?.totalMetric,
    usdPerDayMetric: metrics?.usdPerDayMetric,
    forecastUnavailableCampaignCount,
    ltvClampedUsd,
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

/**
 * Get CSS color class for a Health Factor value (AAV-1252 P6).
 *
 * Thresholds:
 * - HF >= 2:   green (safe)
 * - HF >= 1.5: yellow (caution)
 * - HF >= 1:   orange (warning)
 * - HF < 1:    red (danger)
 * - null / 0:  muted (no borrow or missing data)
 */
export function getHfColorClass(hf: number | null): string {
  if (hf == null || hf === 0) return 'text-muted-foreground';
  if (hf >= 2) return 'text-emerald-600 dark:text-emerald-400';
  if (hf >= 1.5) return 'text-yellow-600 dark:text-yellow-400';
  if (hf >= 1) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-500 dark:text-red-400';
}

/**
 * Get the minimum Health Factor across all pools (AAV-1252 P6).
 *
 * Skips null (no borrow) and 0 (liquidationThreshold undefined) HFs.
 * Returns null when no valid HF exists.
 */
export function getMinHf(healthFactors: { healthFactor: number | null }[]): number | null {
  const validHfs = healthFactors
    .map(hf => hf.healthFactor)
    .filter((hf): hf is number => hf != null && hf > 0);
  return validHfs.length > 0 ? Math.min(...validHfs) : null;
}

