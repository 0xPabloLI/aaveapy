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

import type { MeritIncentive, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';
import { TYDRO_POINT_TO_USD_RATE, getMerklBreakdownApr } from '@/lib/tydro';

export interface IncentiveCalculationOptions {
  includeWhitelistOnlyMerkl?: boolean;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseCampaignBoundaryMs = (value: string | undefined, boundary: 'start' | 'end'): number | null => {
  if (!value) return null;

  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isCampaignActive = (startDate: string | undefined, endDate: string | undefined, nowMs = Date.now()): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (startMs === null || endMs === null) return false;
  return nowMs >= startMs && nowMs <= endMs;
};

/**
 * Helper: Sum valid APR values from an array of numbers
 */
const sumNumberArray = (arr?: number[]): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((sum, val) => {
    return (!isNaN(val) && val >= 0) ? sum + val : sum;
  }, 0);
};

/**
 * Helper: Sum Merit incentive APR values
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumMeritIncentives = (meritIncentives?: MeritIncentive[]): number => {
  if (!meritIncentives || !Array.isArray(meritIncentives)) return 0;
  return meritIncentives.reduce((sum, incentive) => {
    if (!isCampaignActive(incentive.startDate, incentive.endDate)) return sum;
    const apr = incentive.apr;
    const selfApr = incentive.selfApr || 0;
    // Sum both apr and selfApr if they are valid (>= 0 to include active zero-APR campaigns)
    const totalApr = (!isNaN(apr) && apr >= 0 ? apr : 0) + (!isNaN(selfApr) && selfApr >= 0 ? selfApr : 0);
    return sum + totalApr;
  }, 0);
};

/**
 * Helper: Sum Merit incentive APY values (convert each APR to APY then sum)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumMeritIncentivesApy = (meritIncentives?: MeritIncentive[]): number => {
  if (!meritIncentives || !Array.isArray(meritIncentives)) return 0;
  return meritIncentives.reduce((sum, incentive) => {
    if (!isCampaignActive(incentive.startDate, incentive.endDate)) return sum;
    const apr = incentive.apr;
    const selfApr = incentive.selfApr || 0;
    let totalApy = 0;
    if (!isNaN(apr) && apr >= 0) {
      totalApy += convertAprToApy(apr);
    }
    if (!isNaN(selfApr) && selfApr >= 0) {
      totalApy += convertAprToApy(selfApr);
    }
    return sum + totalApy;
  }, 0);
};

/**
 * Helper: Calculate total Merkl APR from opportunity groups
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumMerklOpportunities = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const includeWhitelistOnlyMerkl = options.includeWhitelistOnlyMerkl === true;
  if (!opportunities || !Array.isArray(opportunities)) return 0;
  return opportunities.reduce((sum, opp) => {
    const breakdownsApr = opp.breakdowns.reduce((breakdownSum, breakdown) => {
      if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return breakdownSum;
      if (breakdown.whitelistOnly && !includeWhitelistOnlyMerkl) return breakdownSum;
      const apr = getMerklBreakdownApr(breakdown, pointToUsdRate);
      return breakdownSum + (!isNaN(apr) && apr >= 0 ? apr : 0);
    }, 0);
    return sum + breakdownsApr;
  }, 0);
};

/**
 * Helper: Calculate total Merkl APY from opportunity groups (convert each APR to APY then sum)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumMerklOpportunitiesApy = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const includeWhitelistOnlyMerkl = options.includeWhitelistOnlyMerkl === true;
  if (!opportunities || !Array.isArray(opportunities)) return 0;
  return opportunities.reduce((sum, opp) => {
    const breakdownsApy = opp.breakdowns.reduce((breakdownSum, breakdown) => {
      if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return breakdownSum;
      if (breakdown.whitelistOnly && !includeWhitelistOnlyMerkl) return breakdownSum;
      const apr = getMerklBreakdownApr(breakdown, pointToUsdRate);
      if (!isNaN(apr) && apr >= 0) {
        return breakdownSum + convertAprToApy(apr);
      }
      return breakdownSum;
    }, 0);
    return sum + breakdownsApy;
  }, 0);
};

/**
 * Helper: Sum Brevis incentives (supports array or legacy single APR)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumBrevisIncentives = (brevis?: BrevisIncentive[]): number => {
  if (!brevis || !Array.isArray(brevis)) return 0;
  return brevis.reduce((sum, entry) => {
    if (!isCampaignActive(entry.startDate, entry.endDate)) return sum;
    const apr = entry.apr;
    return sum + (!isNaN(apr) && apr >= 0 ? apr : 0);
  }, 0);
};

/**
 * Helper: Sum Brevis incentives as APY (supports array or legacy single APR)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumBrevisIncentivesApy = (brevis?: BrevisIncentive[]): number => {
  if (!brevis || !Array.isArray(brevis)) return 0;
  return brevis.reduce((sum, entry) => {
    if (!isCampaignActive(entry.startDate, entry.endDate)) return sum;
    const apr = entry.apr;
    return sum + (!isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0);
  }, 0);
};

/**
 * Calculate total incentive APR from detailed sources
 * All values are in percentage form (e.g., 5 for 5%)
 * @param meritIncentives - Merit incentive objects array
 * @param merklOpportunities - Merkl opportunity groups array
 * @param brevisIncentives - Brevis incentives array
 * @param protocolIncentives - Protocol incentives array (number[])
 */
export const calculateTotalIncentiveApr = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApr = sumMeritIncentives(meritIncentives);
  const merklApr = sumMerklOpportunities(merklOpportunities, tydroPointToUsdRate, options);
  const protocolApr = sumNumberArray(protocolIncentives);
  const brevisAprValue = sumBrevisIncentives(brevisIncentives);
  
  return meritApr + merklApr + protocolApr + brevisAprValue;
};

/**
 * Calculate total incentive APY from detailed sources
 * Converts each APR source to APY and sums them (each source converted separately, then summed)
 * @param meritIncentives - Merit incentive objects array
 * @param merklOpportunities - Merkl opportunity groups array
 * @param brevisIncentives - Brevis incentives array
 * @param protocolIncentives - Protocol incentives array (number[])
 */
export const calculateTotalIncentiveApy = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApy = sumMeritIncentivesApy(meritIncentives);
  const merklApy = sumMerklOpportunitiesApy(merklOpportunities, tydroPointToUsdRate, options);
  
  // Convert protocol incentives (already in APR form) to APY
  let protocolApy = 0;
  if (protocolIncentives && Array.isArray(protocolIncentives)) {
    protocolIncentives.forEach(apr => {
      if (!isNaN(apr) && apr >= 0) {
        protocolApy += convertAprToApy(apr);
      }
    });
  }
  
  const brevisApy = sumBrevisIncentivesApy(brevisIncentives);
  
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

// Format USD price (e.g., 3942.52 → "$3,942.52", 0.9998 → "$1.00")
export const formatUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value >= 1000) {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + value.toFixed(2);
};

// Format reserve size in USD with abbreviation (e.g., 1083255123.44 → "$1.08B", 5200000 → "$5.20M", -18807985.72 → "-$18.81M")
export const formatReserveSizeUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1_000_000_000) {
    return sign + '$' + (absValue / 1_000_000_000).toFixed(2) + 'B';
  }
  if (absValue >= 1_000_000) {
    return sign + '$' + (absValue / 1_000_000).toFixed(2) + 'M';
  }
  if (absValue >= 1_000) {
    return sign + '$' + (absValue / 1_000).toFixed(2) + 'K';
  }
  return sign + '$' + absValue.toFixed(2);
};

export const formatReserveSizeToken = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1_000_000_000) {
    return sign + (absValue / 1_000_000_000).toFixed(2) + 'B';
  }
  if (absValue >= 1_000_000) {
    return sign + (absValue / 1_000_000).toFixed(2) + 'M';
  }
  if (absValue >= 1_000) {
    return sign + (absValue / 1_000).toFixed(2) + 'K';
  }
  return sign + absValue.toFixed(2);
};

interface FormatScenarioSizeOptions {
  inputMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}

export const formatScenarioSize = (
  value: number | null | undefined,
  {
    inputMode = 'usd',
    tokenPrice,
  }: FormatScenarioSizeOptions = {}
): string => {
  if (inputMode === 'usd') {
    return formatReserveSizeUsd(value);
  }
  if (
    value === null ||
    value === undefined ||
    isNaN(value) ||
    tokenPrice === null ||
    tokenPrice === undefined ||
    !Number.isFinite(tokenPrice) ||
    tokenPrice <= 0
  ) {
    return '-';
  }

  return formatReserveSizeToken(value / tokenPrice);
};

export const formatScenarioSizeDelta = (
  value: number | null | undefined,
  options: FormatScenarioSizeOptions = {}
): string => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatScenarioSize(value, options)}`;
};

// Domain aliases that share the same USD-size formatting.
export const formatTvl = formatReserveSizeUsd;
export const formatSupplyUsd = formatReserveSizeUsd;
