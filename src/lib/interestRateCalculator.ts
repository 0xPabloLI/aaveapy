import type { ReserveWithSpread } from '@/types/aave';

/**
 * Minimal set of fields required for native rate simulation.
 *
 * All rate-model fields are now percent numbers (e.g., 9 = 9%) as produced
 * by the unified V3/V4 backend. No RAY/bps string conversion needed.
 */
export interface RateCalcInput {
  decimals?: number;
  liquidity: string;
  borrowed: string;
  deficit: string;
  protocolFee: number;
  slopeBelowOptimal: number;
  slopeAboveOptimal: number;
  baseBorrowRate: number;
  optimalUtilization: number;
  hubBorrowed?: string;
  hubSupplied?: string;
}

/** Type guard: returns true when a reserve has all fields needed for rate calculation.
 *  decimals is optional — downstream defaults to 18 when missing. */
export function hasRateCalcFields(reserve: ReserveWithSpread): reserve is ReserveWithSpread & RateCalcInput {
  return (
    reserve.liquidity != null &&
    reserve.borrowed != null &&
    reserve.deficit != null &&
    reserve.protocolFee != null &&
    reserve.slopeBelowOptimal != null &&
    reserve.slopeAboveOptimal != null &&
    reserve.baseBorrowRate != null &&
    reserve.optimalUtilization != null
  );
}

/**
 * Aave two-slope interest rate model using Float percent math.
 *
 * Inputs are percent numbers (e.g., optimalUtilization = 80 for 80%).
 *
 * Borrow rate (two-slope model):
 *   if utilization <= optimal:
 *     borrowRate = baseRate + slope1 * (utilization / optimal)
 *   else:
 *     borrowRate = baseRate + slope1 + slope2 * (utilization - optimal) / (100 - optimal)
 *
 * Supply rate (liquidity rate):
 *   supplyRate = borrowRate * utilization * (1 - protocolFee / 100)
 *   where utilization = borrowed / (liquidity + borrowed)
 *   (Note: supply-side utilization includes deficit in denominator)
 *
 * APY conversion:
 *   apy = (1 + apr / (100 * SECONDS_PER_YEAR)) ^ SECONDS_PER_YEAR - 1, in percent
 */
function calculateVariableBorrowRate(
  utilizationPct: number,
  optimalUsageRatePct: number,
  baseVariableBorrowRatePct: number,
  variableRateSlope1Pct: number,
  variableRateSlope2Pct: number
): number {
  const optimal = Math.max(optimalUsageRatePct, 0.0001); // avoid division by zero

  if (utilizationPct > optimal) {
    // Above optimal: borrowRate = baseRate + slope1 + slope2 * (util - optimal) / (100 - optimal)
    const excessRatio = (utilizationPct - optimal) / (100 - optimal);
    return baseVariableBorrowRatePct + variableRateSlope1Pct + variableRateSlope2Pct * Math.max(excessRatio, 0);
  }

  // Below or at optimal: borrowRate = baseRate + slope1 * (util / optimal)
  const normalizedUsage = Math.max(utilizationPct, 0) / optimal;
  return baseVariableBorrowRatePct + variableRateSlope1Pct * normalizedUsage;
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Convert an APR percentage to APY percentage using per-second compounding.
 * aprPercent: e.g., 5 means 5% APR
 * Returns: e.g., 5.127... means ~5.13% APY
 */
function aprPercentToApyPercent(aprPercent: number): number {
  if (aprPercent <= 0) return 0;
  const aprDecimal = aprPercent / 100;
  const ratePerSecond = aprDecimal / SECONDS_PER_YEAR;
  const compounded = Math.pow(1 + ratePerSecond, SECONDS_PER_YEAR);
  return (compounded - 1) * 100;
}

function parseUnits(amount: string, decimals: number): bigint {
  const cleaned = amount.replace(/,/g, '').trim();
  if (!cleaned) return 0n;
  if (!/^\d*\.?\d*$/.test(cleaned)) return 0n;
  const [intRaw, fracRaw = ''] = cleaned.split('.');
  const intPart = intRaw || '0';
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const scale = 10n ** BigInt(safeDecimals);
  const fracPadded = (fracRaw + '0'.repeat(safeDecimals)).slice(0, safeDecimals);
  const fracPart = fracPadded ? BigInt(fracPadded) : 0n;
  return BigInt(intPart) * scale + fracPart;
}

export interface NativeRateSimulation {
  /** RAY string for backward-compat usage in return type (kept for external consumers). */
  utilizationRateRay: string;
  utilizationRatePercent: number;
  optimalUtilizationPercent: number;
  supplyAprPercent: number;
  borrowAprPercent: number;
  supplyApyPercent: number;
  borrowApyPercent: number;
  addedLiquidityRaw: string;
  addedBorrowRaw: string;
}

function computeRates(
  rateInput: RateCalcInput,
  borrowUsageDenominator: bigint,
  supplyUsageDenominator: bigint,
  totalBorrowed: bigint,
  addedLiquidityRaw: bigint,
  addedBorrowRaw: bigint,
): NativeRateSimulation {
  // Convert raw BigInt amounts to decimal token counts for Float math.
  // We use Number() after dividing by a scale factor to keep values well
  // within safe integer range (< 2^53). The scale is derived from the
  // token decimals so the resulting numbers are in human-readable token units.
  const decimals = Number.isFinite(rateInput.decimals) ? rateInput.decimals : 18;
  const scaleNumber = Math.pow(10, decimals);

  const totalBorrowedTokens = Number(totalBorrowed) / scaleNumber;
  const borrowDenominatorTokens = Number(borrowUsageDenominator) / scaleNumber;
  const supplyDenominatorTokens = Number(supplyUsageDenominator) / scaleNumber;

  // Utilization as percent (0-100)
  const borrowUsageRatePct =
    borrowDenominatorTokens > 0
      ? (totalBorrowedTokens / borrowDenominatorTokens) * 100
      : 0;

  const supplyUsageRatePct =
    supplyDenominatorTokens > 0
      ? (totalBorrowedTokens / supplyDenominatorTokens) * 100
      : 0;

  const borrowRatePct = calculateVariableBorrowRate(
    borrowUsageRatePct,
    rateInput.optimalUtilization,
    rateInput.baseBorrowRate,
    rateInput.slopeBelowOptimal,
    rateInput.slopeAboveOptimal
  );

  // supplyRate = borrowRate * utilization * (1 - protocolFee / 100)
  const protocolFeeFraction = Math.max(0, Math.min(100, rateInput.protocolFee)) / 100;
  const supplyRatePct = borrowRatePct * (supplyUsageRatePct / 100) * (1 - protocolFeeFraction);

  return {
    utilizationRateRay: String(borrowUsageRatePct),
    utilizationRatePercent: Math.max(0, borrowUsageRatePct),
    optimalUtilizationPercent: rateInput.optimalUtilization,
    supplyAprPercent: Math.max(0, supplyRatePct),
    borrowAprPercent: Math.max(0, borrowRatePct),
    supplyApyPercent: Math.max(0, aprPercentToApyPercent(supplyRatePct)),
    borrowApyPercent: Math.max(0, aprPercentToApyPercent(borrowRatePct)),
    addedLiquidityRaw: addedLiquidityRaw.toString(),
    addedBorrowRaw: addedBorrowRaw.toString(),
  };
}

export interface NativeRateActionInputs {
  supplyAmount?: string;
  borrowAmount?: string;
}

export function simulateNativeRatesAfterActions(
  rateInput: RateCalcInput,
  { supplyAmount = '0', borrowAmount = '0' }: NativeRateActionInputs
): NativeRateSimulation {
  const decimals = Number.isFinite(rateInput.decimals) ? rateInput.decimals : 18;
  const addedLiquidity = parseUnits(supplyAmount, decimals);
  const addedBorrow = parseUnits(borrowAmount, decimals);

  // On-chain raw string values are already in base units (e.g., 1e18 per token).
  // Use BigInt directly — no additional parseUnits scaling.
  const baseLiquidity = BigInt(rateInput.liquidity || '0');
  const baseBorrowed = BigInt(rateInput.borrowed || '0');
  const baseDeficit = BigInt(rateInput.deficit || '0');
  const newBorrowed = baseBorrowed + addedBorrow;

  // borrowUsageDenominator: does NOT include deficit (used for borrow rate, external utilization display)
  const borrowUsageDenominatorRaw = baseLiquidity + baseBorrowed + addedLiquidity;
  const borrowUsageDenominator = borrowUsageDenominatorRaw > 0n ? borrowUsageDenominatorRaw : 0n;

  // supplyUsageDenominator: includes deficit (used for liquidity rate calculation)
  const supplyUsageDenominatorRaw = baseLiquidity + baseBorrowed + baseDeficit + addedLiquidity;
  const supplyUsageDenominator = supplyUsageDenominatorRaw > 0n ? supplyUsageDenominatorRaw : 0n;

  return computeRates(rateInput, borrowUsageDenominator, supplyUsageDenominator, newBorrowed, addedLiquidity, addedBorrow);
}

export function simulateNativeRatesAfterSupply(
  rateInput: RateCalcInput,
  supplyAmount: string
): NativeRateSimulation {
  return simulateNativeRatesAfterActions(rateInput, { supplyAmount, borrowAmount: '0' });
}

export function simulateNativeRatesAfterBorrow(
  rateInput: RateCalcInput,
  borrowAmount: string
): NativeRateSimulation {
  return simulateNativeRatesAfterActions(rateInput, { supplyAmount: '0', borrowAmount });
}
