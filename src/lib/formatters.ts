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

import {
  ETHEREUM_MARKET_NAMES,
  type BrevisIncentive,
  type MeritIncentive,
  type MerklOpportunityGroup,
  type ReserveWithSpread,
} from '@/types/aave';
import { isCampaignActive, sumActiveCampaignBreakdownValues } from '@/lib/campaignGroups';
import {
  getBrevisCampaignBreakdowns,
  getBrevisResolvedBreakdown,
} from '@/lib/brevis';
import { TYDRO_POINT_TO_USD_RATE } from '@/lib/tydro';
import { getMerklBreakdownApr, forecastBreakdownApr, sanitizePercent } from '@/lib/merklForecast';
import type { MerklForecastWireItem } from '@/types/aave';

/**
 * Opt-in key for whitelist-only Merkl breakdowns that have no usable `campaignId` (empty after trim).
 * Stored in `whitelistMerklCampaignIds` alongside real Merkl campaign ids.
 */
export const MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL = '__merklWhitelistNoCampaignId__' as const;

/** Visible label next to Merkl whitelist-only opt-in (tooltip + forecast panel). */
export const MERKL_WHITELIST_TOGGLE_LABEL = 'Include as WL user';

/**
 * Accessible name for the opt-in control: checked = include this campaign in totals as a WL participant.
 */
export const MERKL_WHITELIST_TOGGLE_ARIA =
  'Include this Merkl campaign in incentive totals. Confirm you are a whitelist participant for this campaign.';

/**
 * Whether a Merkl breakdown should count toward incentive totals.
 * Non-whitelist campaigns always count; whitelist-only counts only when the user enabled this campaignId,
 * or the sentinel when there is no campaign id.
 */
export function isMerklWhitelistBreakdownIncluded(
  breakdown: { whitelistOnly?: boolean; campaignId: string },
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined
): boolean {
  if (!breakdown.whitelistOnly) return true;
  const id = String(breakdown.campaignId || '').trim();
  if (!id) {
    return Boolean(whitelistMerklCampaignIds?.has(MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL));
  }
  return Boolean(whitelistMerklCampaignIds?.has(id));
}

export interface IncentiveCalculationOptions {
  /** Merkl campaign IDs the user opted into for whitelist-only APR */
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  /** When provided, enables forecastWithTVL-based fallback for campaigns where getMerklBreakdownApr returns 0. */
  forecastStates?: Record<string, MerklForecastWireItem>;
}

/** Shared market label rendering: Ethereum sub-markets use canonical market names, others use chain name. */
export function getReserveMarketDisplayName(
  market: Pick<ReserveWithSpread, 'chainName' | 'marketName'>
): string {
  if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
    return ETHEREUM_MARKET_NAMES[market.marketName];
  }
  return market.chainName;
}

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
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds),
    mapValue: (_group, breakdown) => {
      const apr = options.forecastStates
        ? sanitizePercent(forecastBreakdownApr(breakdown, 0, options.forecastStates, pointToUsdRate))
        : getMerklBreakdownApr(breakdown, pointToUsdRate);
      return !isNaN(apr) && apr >= 0 ? apr : 0;
    },
  });
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
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds),
    mapValue: (_group, breakdown) => {
      const apr = options.forecastStates
        ? sanitizePercent(forecastBreakdownApr(breakdown, 0, options.forecastStates, pointToUsdRate))
        : getMerklBreakdownApr(breakdown, pointToUsdRate);
      return !isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0;
    },
  });
};

/**
 * Helper: Sum Brevis incentives (supports array or legacy single APR)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumBrevisIncentives = (brevis?: BrevisIncentive[]): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const apr = getBrevisResolvedBreakdown(group, breakdown).campaignApr;
      return !isNaN(apr) && apr >= 0 ? apr : 0;
    },
  });
};

/**
 * Helper: Sum Brevis incentives as APY (supports array or legacy single APR)
 * Note: only active campaigns are counted; apr >= 0 keeps zero-APR active campaigns
 */
const sumBrevisIncentivesApy = (brevis?: BrevisIncentive[]): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const apr = getBrevisResolvedBreakdown(group, breakdown).campaignApr;
      return !isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0;
    },
  });
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

/**
 * Aggregate incentive APR/APY for one reserve side, used by reserves table and top opportunities.
 */
export function getReserveIncentiveValues(
  reserve: ReserveWithSpread,
  side: 'supply' | 'borrow',
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): { apr: number; apy: number } {
  const protocolIncentives = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  const meritIncentives = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  const merklOpportunities = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  const brevisIncentives = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;

  return {
    apr: calculateTotalIncentiveApr(
      meritIncentives,
      merklOpportunities,
      brevisIncentives,
      protocolIncentives,
      tydroPointToUsdRate,
      options
    ),
    apy: calculateTotalIncentiveApy(
      meritIncentives,
      merklOpportunities,
      brevisIncentives,
      protocolIncentives,
      tydroPointToUsdRate,
      options
    ),
  };
}

// Calculate total Supply APR (native + incentive)
export const calculateTotalSupplyApr = (nativeSupplyApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeSupplyApr === null || nativeSupplyApr === undefined) return null;
  if (isNaN(nativeSupplyApr) || isNaN(incentiveApr)) return null;
  return nativeSupplyApr + incentiveApr;
};

// Calculate total Supply APY (native + incentive)
export const calculateTotalSupplyApy = (nativeSupplyApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeSupplyApy === null || nativeSupplyApy === undefined) return null;
  if (isNaN(nativeSupplyApy) || isNaN(incentiveApy)) return null;
  return nativeSupplyApy + incentiveApy;
};

// Calculate total Borrow APR (native - incentive)
export const calculateTotalBorrowApr = (nativeBorrowApr: number | null | undefined, incentiveApr: number): number | null => {
  if (nativeBorrowApr === null || nativeBorrowApr === undefined) return null;
  if (isNaN(nativeBorrowApr) || isNaN(incentiveApr)) return null;
  return nativeBorrowApr - incentiveApr;
};

// Calculate total Borrow APY (native - incentive)
export const calculateTotalBorrowApy = (nativeBorrowApy: number | null | undefined, incentiveApy: number): number | null => {
  if (nativeBorrowApy === null || nativeBorrowApy === undefined) return null;
  if (isNaN(nativeBorrowApy) || isNaN(incentiveApy)) return null;
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

// Format USD price (e.g., 3942.52 → "$3,942.52", 0.9998 → "$1.00")
export const formatUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value >= 1000) {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + value.toFixed(2);
};

/** Daily fraction of principal from an annual rate expressed as percent (e.g. 5 for 5%). */
export function annualPercentToDailyFraction(ratePercent: number, isApy: boolean): number {
  if (!Number.isFinite(ratePercent)) return Number.NaN;
  if (isApy) {
    const r = ratePercent / 100;
    return Math.pow(1 + r, 1 / 365) - 1;
  }
  return (ratePercent / 100) / 365;
}

/** USD with leading + / − (Unicode minus) for signed cashflows; null/NaN → em dash. */
export function formatSignedUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatUsd(Math.abs(value))}`;
}

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

/**
 * Signed daily scenario cashflow: USD when `inputMode` is `usd`, token/day (USD ÷ price) when `token`.
 * Matches `formatScenarioSize` semantics when token price is missing in token mode.
 */
export function formatSignedScenarioDailyCashflow(
  valueUsd: number | null | undefined,
  options: { inputMode?: 'usd' | 'token'; tokenPrice?: number | null } = {},
): string {
  const { inputMode = 'usd', tokenPrice } = options;
  if (valueUsd === null || valueUsd === undefined || Number.isNaN(valueUsd)) return '—';
  if (inputMode === 'usd') {
    return formatSignedUsd(valueUsd);
  }
  if (
    tokenPrice === null ||
    tokenPrice === undefined ||
    !Number.isFinite(tokenPrice) ||
    tokenPrice <= 0
  ) {
    return '—';
  }
  const tokenAmount = valueUsd / tokenPrice;
  const sign = tokenAmount > 0 ? '+' : tokenAmount < 0 ? '−' : '';
  return `${sign}${formatReserveSizeToken(Math.abs(tokenAmount))}`;
}

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

/**
 * Whether a reserve would show at least one protocol / Merit / Merkl / Brevis row in
 * the incentive tooltip (same rules as `IncentiveTooltip` source aggregation).
 */
export function reserveHasIncentiveTooltipSources(
  reserve: ReserveWithSpread,
  side: 'supply' | 'borrow',
  isApy: boolean,
  tydroPointToUsdRate: number,
): boolean {
  const protocolIncentives = side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
  if (protocolIncentives && protocolIncentives.length > 0) {
    return true;
  }

  const meritIncentives = side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
  if (meritIncentives?.length) {
    for (const merit of meritIncentives) {
      if (!isCampaignActive(merit.startDate, merit.endDate)) continue;
      const apr = merit.apr;
      const selfApr = merit.selfApr || 0;
      const baseAprPercent = !isNaN(apr) && apr >= 0 ? apr : 0;
      const selfAprPercent = !isNaN(selfApr) && selfApr >= 0 ? selfApr : 0;
      let totalValue = 0;
      if (isApy) {
        if (baseAprPercent > 0) totalValue += convertAprToApy(baseAprPercent);
        if (selfAprPercent > 0) totalValue += convertAprToApy(selfAprPercent);
      } else {
        totalValue = baseAprPercent + selfAprPercent;
      }
      if (totalValue >= 0) return true;
    }
  }

  const brevisIncentives = side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
  if (brevisIncentives?.length) {
    for (const brevis of brevisIncentives) {
      const resolved = getBrevisResolvedBreakdown(brevis);
      if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) continue;
      const apr = resolved.campaignApr;
      if (!isNaN(apr) && apr >= 0) return true;
    }
  }

  const opportunities = side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
  if (opportunities?.length) {
    for (const opportunity of opportunities) {
      for (const breakdown of opportunity.breakdowns ?? []) {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) continue;
        const apr = getMerklBreakdownApr(breakdown, tydroPointToUsdRate);
        if (!isNaN(apr) && apr >= 0) return true;
      }
    }
  }

  return false;
}

/**
 * When to show the incentive badge + native/incentive sub-row in the reserves table / mobile cards.
 * Uses the same headline total as the table (`rawIncentive`) but avoids hiding the row when the
 * total is 0 while the tooltip still has sources (e.g. whitelist-only Merkl not yet opted in).
 * Previously `rawIncentive < 0.01` hid the whole row and removed access to the tooltip.
 */
export function resolveVisibleIncentiveBadgeValue(
  rawIncentive: number | null,
  reserve: ReserveWithSpread,
  side: 'supply' | 'borrow',
  isApy: boolean,
  tydroPointToUsdRate: number,
): number | null {
  if (rawIncentive === null || Number.isNaN(rawIncentive) || rawIncentive < 0) return null;
  if (rawIncentive > 0) return rawIncentive;
  if (rawIncentive === 0 && reserveHasIncentiveTooltipSources(reserve, side, isApy, tydroPointToUsdRate)) {
    return rawIncentive;
  }
  return null;
}
