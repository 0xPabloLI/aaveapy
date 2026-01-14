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

import type { MeritIncentive, MerklOpportunityGroup } from '@/types/aave';

/**
 * Helper: Sum valid APR values from an array of numbers
 */
const sumNumberArray = (arr?: number[]): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((sum, val) => {
    return (!isNaN(val) && val > 0) ? sum + val : sum;
  }, 0);
};

/**
 * Helper: Sum Merit incentive APR values
 */
const sumMeritIncentives = (meritIncentives?: MeritIncentive[]): number => {
  if (!meritIncentives || !Array.isArray(meritIncentives)) return 0;
  return meritIncentives.reduce((sum, incentive) => {
    const apr = incentive.apr;
    const selfApr = incentive.selfApr || 0;
    // Sum both apr and selfApr if they are valid
    const totalApr = (!isNaN(apr) && apr > 0 ? apr : 0) + (!isNaN(selfApr) && selfApr > 0 ? selfApr : 0);
    return sum + totalApr;
  }, 0);
};

/**
 * Helper: Sum Merit incentive APY values (convert each APR to APY then sum)
 */
const sumMeritIncentivesApy = (meritIncentives?: MeritIncentive[]): number => {
  if (!meritIncentives || !Array.isArray(meritIncentives)) return 0;
  return meritIncentives.reduce((sum, incentive) => {
    const apr = incentive.apr;
    const selfApr = incentive.selfApr || 0;
    let totalApy = 0;
    if (!isNaN(apr) && apr > 0) {
      totalApy += convertAprToApy(apr);
    }
    if (!isNaN(selfApr) && selfApr > 0) {
      totalApy += convertAprToApy(selfApr);
    }
    return sum + totalApy;
  }, 0);
};

/**
 * Helper: Calculate total Merkl APR from opportunity groups
 */
const sumMerklOpportunities = (opportunities?: MerklOpportunityGroup[]): number => {
  if (!opportunities || !Array.isArray(opportunities)) return 0;
  return opportunities.reduce((sum, opp) => {
    const breakdownsApr = opp.breakdowns.reduce((breakdownSum, breakdown) => {
      const apr = breakdown.campaignApr;
      return breakdownSum + (!isNaN(apr) && apr > 0 ? apr : 0);
    }, 0);
    return sum + breakdownsApr;
  }, 0);
};

/**
 * Helper: Calculate total Merkl APY from opportunity groups (convert each APR to APY then sum)
 */
const sumMerklOpportunitiesApy = (opportunities?: MerklOpportunityGroup[]): number => {
  if (!opportunities || !Array.isArray(opportunities)) return 0;
  return opportunities.reduce((sum, opp) => {
    const breakdownsApy = opp.breakdowns.reduce((breakdownSum, breakdown) => {
      const apr = breakdown.campaignApr;
      if (!isNaN(apr) && apr > 0) {
        return breakdownSum + convertAprToApy(apr);
      }
      return breakdownSum;
    }, 0);
    return sum + breakdownsApy;
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
 * @param meritIncentives - Merit incentive objects array
 * @param merklOpportunities - Merkl opportunity groups array
 * @param brevisApr - Brevis APR incentive
 * @param protocolIncentives - Protocol incentives array (number[])
 */
export const calculateTotalIncentiveApr = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisApr?: number | null,
  protocolIncentives?: number[]
): number => {
  const meritApr = sumMeritIncentives(meritIncentives);
  const merklApr = sumMerklOpportunities(merklOpportunities);
  const protocolApr = sumNumberArray(protocolIncentives);
  const brevisAprValue = getValidApr(brevisApr);
  
  return meritApr + merklApr + protocolApr + brevisAprValue;
};

/**
 * Calculate total incentive APY from detailed sources
 * Converts each APR source to APY and sums them (each source converted separately, then summed)
 * @param meritIncentives - Merit incentive objects array
 * @param merklOpportunities - Merkl opportunity groups array
 * @param brevisApr - Brevis APR incentive
 * @param protocolIncentives - Protocol incentives array (number[])
 */
export const calculateTotalIncentiveApy = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisApr?: number | null,
  protocolIncentives?: number[]
): number => {
  const meritApy = sumMeritIncentivesApy(meritIncentives);
  const merklApy = sumMerklOpportunitiesApy(merklOpportunities);
  
  // Convert protocol incentives (already in APR form) to APY
  let protocolApy = 0;
  if (protocolIncentives && Array.isArray(protocolIncentives)) {
    protocolIncentives.forEach(apr => {
      if (!isNaN(apr) && apr > 0) {
        protocolApy += convertAprToApy(apr);
      }
    });
  }
  
  const brevisAprValue = getValidApr(brevisApr);
  const brevisApy = brevisAprValue > 0 ? convertAprToApy(brevisAprValue) : 0;
  
  return meritApy + merklApy + protocolApy + brevisApy;
};

// Calculate total Supply APR (native + incentive)
// All values are in percentage form
export const calculateTotalSupplyApr = (supplyApy: number | null | undefined, incentiveApr: number): number | null => {
  if (supplyApy === null || supplyApy === undefined) return null;
  if (isNaN(supplyApy) || isNaN(incentiveApr)) return null;
  return supplyApy + incentiveApr;
};

// Calculate total Supply APY (native + incentive)
// All values are in percentage form
export const calculateTotalSupplyApy = (supplyApy: number | null | undefined, incentiveApy: number): number | null => {
  if (supplyApy === null || supplyApy === undefined) return null;
  if (isNaN(supplyApy) || isNaN(incentiveApy)) return null;
  return supplyApy + incentiveApy;
};

// Calculate total Borrow APR (native - incentive)
// All values are in percentage form
export const calculateTotalBorrowApr = (borrowApy: number | null | undefined, incentiveApr: number): number | null => {
  if (borrowApy === null || borrowApy === undefined) return null;
  if (isNaN(borrowApy) || isNaN(incentiveApr)) return null;
  return borrowApy - incentiveApr;
};

// Calculate total Borrow APY (native - incentive)
// All values are in percentage form
export const calculateTotalBorrowApy = (borrowApy: number | null | undefined, incentiveApy: number): number | null => {
  if (borrowApy === null || borrowApy === undefined) return null;
  if (isNaN(borrowApy) || isNaN(incentiveApy)) return null;
  return borrowApy - incentiveApy;
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
