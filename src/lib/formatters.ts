// Format percentage to string (value is already in percentage form, e.g., 5 for 5%)
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
};

// Format spread with sign (value is already in percentage form)
export const formatSpread = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Format relative time
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

/**
 * Converts APR to APY using monthly compounding
 * Assumes users claim rewards once per month and reinvest them
 * Formula: APY = (1 + APR/12)^12 - 1
 *
 * This function is used to align incentive calculations with other protocol APYs
 * throughout the app, providing more accurate representations of compound returns.
 *
 * @param apr - Annual Percentage Rate as a percentage (e.g., 5 for 5%)
 * @returns APY as a percentage
 */
export const convertAprToApy = (apr: number): number => {
  // Convert percentage to decimal for calculation
  const aprDecimal = apr / 100;
  const monthlyRate = aprDecimal / 12;
  const apyDecimal = Math.pow(1 + monthlyRate, 12) - 1;
  // Convert back to percentage
  return apyDecimal * 100;
};

// Convert APY to APR (reverse of convertAprToApy)
export const apyToApr = (apy: number): number => {
  // Convert percentage to decimal
  const apyDecimal = apy / 100;
  // Reverse the monthly compounding formula
  // APY = (1 + APR/12)^12 - 1
  // APR = 12 * ((1 + APY)^(1/12) - 1)
  const aprDecimal = 12 * (Math.pow(1 + apyDecimal, 1 / 12) - 1);
  // Convert back to percentage
  return aprDecimal * 100;
};

// Truncate address
export const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

type AprSource = string | { apr: string };

/**
 * Helper: Sum valid APR values from an array of percentage strings or objects
 */
export const sumAprSources = (aprSources?: AprSource[]): number => {
  if (!aprSources || !Array.isArray(aprSources)) return 0;
  return aprSources.reduce((sum, aprSource) => {
    const aprStr = typeof aprSource === 'string' ? aprSource : aprSource.apr;
    const apr = parseFloat(aprStr);
    return !isNaN(apr) && apr > 0 ? sum + apr : sum;
  }, 0);
};

/**
 * Helper: Sum valid APY values from APR sources (convert each APR to APY then sum)
 */
export const sumApyFromAprSources = (aprSources?: AprSource[]): number => {
  if (!aprSources || !Array.isArray(aprSources)) return 0;
  return aprSources.reduce((sum, aprSource) => {
    const aprStr = typeof aprSource === 'string' ? aprSource : aprSource.apr;
    const apr = parseFloat(aprStr);
    if (!isNaN(apr) && apr > 0) {
      return sum + convertAprToApy(apr);
    }
    return sum;
  }, 0);
};

/**
 * Helper: Get valid APR value (percentage form)
 */
const getValidApr = (apr?: number | null): number => {
  return (apr !== undefined && apr !== null && !isNaN(apr) && apr > 0) ? apr : 0;
};

/**
 * Calculate total incentive APR from detailed sources
 * All values are in percentage form (e.g., 5 for 5%)
 * @param meritAprs - Base merit APR incentives
 * @param merklApr - Merkl APR incentive
 * @param brevisApr - Brevis APR incentive
 * @param extraAprs - Additional APR sources (protocol incentives, self incentives, requirement-based incentives)
 */
export const calculateTotalIncentiveApr = (
  meritAprs?: AprSource[],
  merklApr?: number,
  brevisApr?: number | null,
  ...extraAprs: AprSource[][]
): number => {
  const baseApr = sumAprSources(meritAprs);
  const extraApr = extraAprs.reduce((sum, aprs) => sum + sumAprSources(aprs), 0);
  return baseApr + extraApr + getValidApr(merklApr) + getValidApr(brevisApr);
};

/**
 * Calculate total incentive APY from detailed sources
 * Converts each APR source to APY and sums them (each source converted separately, then summed)
 * @param meritAprs - Base merit APR incentives
 * @param merklApr - Merkl APR incentive
 * @param brevisApr - Brevis APR incentive
 * @param extraAprs - Additional APR sources (protocol incentives, self incentives, requirement-based incentives)
 */
export const calculateTotalIncentiveApy = (
  meritAprs?: AprSource[],
  merklApr?: number,
  brevisApr?: number | null,
  ...extraAprs: AprSource[][]
): number => {
  const baseApy = sumApyFromAprSources(meritAprs);
  const extraApy = extraAprs.reduce((sum, aprs) => sum + sumApyFromAprSources(aprs), 0);

  const merklAprValue = getValidApr(merklApr);
  const brevisAprValue = getValidApr(brevisApr);

  return baseApy +
    extraApy +
    (merklAprValue > 0 ? convertAprToApy(merklAprValue) : 0) +
    (brevisAprValue > 0 ? convertAprToApy(brevisAprValue) : 0);
};

// Calculate total Supply APR (native + incentive)
// All values are in percentage form
export const calculateTotalSupplyApr = (supplyApy: string | null | undefined, incentiveApr: number): number | null => {
  if (supplyApy === null || supplyApy === undefined) return null;
  const nativeSupplyApr = parseFloat(supplyApy);
  if (isNaN(nativeSupplyApr) || isNaN(incentiveApr)) return null;
  return nativeSupplyApr + incentiveApr;
};

// Calculate total Supply APY (native + incentive)
// All values are in percentage form
export const calculateTotalSupplyApy = (supplyApy: string | null | undefined, incentiveApy: number): number | null => {
  if (supplyApy === null || supplyApy === undefined) return null;
  const nativeSupplyApy = parseFloat(supplyApy);
  if (isNaN(nativeSupplyApy) || isNaN(incentiveApy)) return null;
  return nativeSupplyApy + incentiveApy;
};

// Calculate total Borrow APR (native - incentive)
// All values are in percentage form
export const calculateTotalBorrowApr = (borrowApy: string | null | undefined, incentiveApr: number): number | null => {
  if (borrowApy === null || borrowApy === undefined) return null;
  const nativeBorrowApr = parseFloat(borrowApy);
  if (isNaN(nativeBorrowApr)) return null;
  if (isNaN(incentiveApr)) return null;
  return nativeBorrowApr - incentiveApr;
};

// Calculate total Borrow APY (native - incentive)
// All values are in percentage form
export const calculateTotalBorrowApy = (borrowApy: string | null | undefined, incentiveApy: number): number | null => {
  if (borrowApy === null || borrowApy === undefined) return null;
  const nativeBorrowApy = parseFloat(borrowApy);
  if (isNaN(nativeBorrowApy)) return null;
  if (isNaN(incentiveApy)) return null;
  return nativeBorrowApy - incentiveApy;
};

// Calculate spread (APY version)
export const calculateSpreadApy = (totalSupplyApy: number | null, totalBorrowApy: number | null): number | null => {
  if (totalSupplyApy === null || totalBorrowApy === null) return null;
  return totalSupplyApy - totalBorrowApy;
};

// Calculate spread (APR version)
export const calculateSpreadApr = (totalSupplyApr: number | null, totalBorrowApr: number | null): number | null => {
  if (totalSupplyApr === null || totalBorrowApr === null) return null;
  return totalSupplyApr - totalBorrowApr;
};
