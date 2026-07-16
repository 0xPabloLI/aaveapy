/**
 * Convert Annual Percentage Rate (simple) to Annual Percentage Yield (compounded monthly).
 * APY > APR for positive rates due to compounding; APY < APR (less negative) for negative rates.
 */
export const convertAprToApy = (apr: number): number => {
  const aprDecimal = apr / 100;
  const monthlyRate = aprDecimal / 12;
  const apyDecimal = Math.pow(1 + monthlyRate, 12) - 1;
  return apyDecimal * 100;
};

/**
 * Scale an APR by a ratio, then optionally convert to APY.
 *
 * Because `convertAprToApy` is nonlinear (monthly compounding), the order matters:
 * `convertAprToApy(apr * ratio) ≠ convertAprToApy(apr) * ratio` when `ratio ≠ 1`.
 * This function enforces the canonical order — scale first, convert second — so that
 * campaign detail rows reconcile with the aggregate path in `incentiveAggregation.ts`,
 * which also scales APR before converting to APY.
 */
export const scaleAprThenConvert = (
  aprPercent: number,
  options: { ratio: number; isApy: boolean },
): number => {
  const scaled = aprPercent * options.ratio;
  return options.isApy ? convertAprToApy(scaled) : scaled;
};

/**
 * Convert Annual Percentage Yield (compounded monthly) back to Annual Percentage Rate (simple).
 * Inverse of {@link convertAprToApy}.
 */
export const apyToApr = (apy: number): number => {
  const apyDecimal = apy / 100;
  const aprDecimal = 12 * (Math.pow(1 + apyDecimal, 1 / 12) - 1);
  return aprDecimal * 100;
};

/**
 * Convert an annual rate (percent) to a daily fraction.
 * When `isApy` is true, uses compounding formula; otherwise simple division by 365.
 * Returns NaN for non-finite input.
 */
export function annualPercentToDailyFraction(ratePercent: number, isApy: boolean): number {
  if (!Number.isFinite(ratePercent)) return Number.NaN;
  if (isApy) {
    const r = ratePercent / 100;
    return Math.pow(1 + r, 1 / 365) - 1;
  }
  return (ratePercent / 100) / 365;
}

/**
 * Calculate total supply APR = native supply APR + incentive APR.
 * Returns null if native is null/undefined/NaN or incentive is NaN.
 */
export const calculateTotalSupplyApr = (nativeSupplyApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeSupplyApr === null || nativeSupplyApr === undefined) return null;
  if (isNaN(nativeSupplyApr) || isNaN(incentiveApr)) return null;
  return nativeSupplyApr + incentiveApr;
};

/**
 * Calculate total supply APY = native supply APY + incentive APY.
 * Returns null if native is null/undefined/NaN or incentive is NaN.
 */
export const calculateTotalSupplyApy = (nativeSupplyApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeSupplyApy === null || nativeSupplyApy === undefined) return null;
  if (isNaN(nativeSupplyApy) || isNaN(incentiveApy)) return null;
  return nativeSupplyApy + incentiveApy;
};

/**
 * Calculate total borrow APR = native borrow APR - incentive APR.
 * Returns null if native is null/undefined/NaN or incentive is NaN.
 */
export const calculateTotalBorrowApr = (nativeBorrowApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeBorrowApr === null || nativeBorrowApr === undefined) return null;
  if (isNaN(nativeBorrowApr) || isNaN(incentiveApr)) return null;
  return nativeBorrowApr - incentiveApr;
};

/**
 * Calculate total borrow APY = native borrow APY - incentive APY.
 * Returns null if native is null/undefined/NaN or incentive is NaN.
 */
export const calculateTotalBorrowApy = (nativeBorrowApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeBorrowApy === null || nativeBorrowApy === undefined) return null;
  if (isNaN(nativeBorrowApy) || isNaN(incentiveApy)) return null;
  return nativeBorrowApy - incentiveApy;
};

/**
 * Calculate spread APR = total supply APR - total borrow APR.
 * Returns null if either input is null.
 */
export const calculateSpreadApr = (totalSupplyApr: number | null, totalBorrowApr: number | null): number | null => {
  if (totalSupplyApr === null || totalBorrowApr === null) return null;
  return totalSupplyApr - totalBorrowApr;
};

/**
 * Calculate spread APY = total supply APY - total borrow APY.
 * Returns null if either input is null.
 */
export const calculateSpreadApy = (totalSupplyApy: number | null, totalBorrowApy: number | null): number | null => {
  if (totalSupplyApy === null || totalBorrowApy === null) return null;
  return totalSupplyApy - totalBorrowApy;
};
