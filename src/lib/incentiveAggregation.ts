import {
  type BrevisIncentive,
  type MeritIncentive,
  type MerklOpportunityGroup,
  type ReserveWithSpread,
  MerklForecastWireItem } from '@/types/aave';
import { isCampaignActive, sumActiveCampaignBreakdownValues } from '@/lib/campaignGroups';
import {
  getBrevisCampaignBreakdowns,
  getBrevisResolvedBreakdown,
  toMerklBreakdown,
} from '@/lib/brevis';
import { TYDRO_POINT_TO_USD_RATE } from '@/lib/tydro';
import { getMerklBreakdownApr, forecastMerklApr, sanitizePercent } from '@/lib/merklForecast';
import { convertAprToApy } from '@/lib/rateCalculations';
import { isMerklWhitelistBreakdownIncluded } from '@/lib/merklWhitelist';

export interface IncentiveCalculationOptions {
  /** Merkl campaign IDs the user opted into for whitelist-only APR */
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  /** When provided, enables forecastWithTVL-based fallback for campaigns where getMerklBreakdownApr returns 0. */
  forecastStates?: Record<string, MerklForecastWireItem>;
  /** Per-campaignId access status from /meta/side-data.campaignAccess (AAV-66). */
  campaignAccessStatuses?: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'>;
}

const sumNumberArray = (arr?: number[]): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((sum, val) => {
    return (!isNaN(val) && val >= 0) ? sum + val : sum;
  }, 0);
};

export const sumMeritIncentiveApr = (meritIncentives?: MeritIncentive[]): number => {
  if (!meritIncentives || !Array.isArray(meritIncentives)) return 0;
  return meritIncentives.reduce((sum, incentive) => {
    if (!isCampaignActive(incentive.startDate, incentive.endDate)) return sum;
    const apr = incentive.apr;
    const selfApr = incentive.selfApr || 0;
    const totalApr = (!isNaN(apr) && apr >= 0 ? apr : 0) + (!isNaN(selfApr) && selfApr >= 0 ? selfApr : 0);
    return sum + totalApr;
  }, 0);
};

const sumMeritIncentiveApy = (meritIncentives?: MeritIncentive[]): number => {
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

const sumMerklIncentiveApr = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds, options.campaignAccessStatuses?.[breakdown.campaignId]),
    mapValue: (_group, breakdown) => {
      const apr = options.forecastStates
        ? sanitizePercent(forecastMerklApr(breakdown, 0, options.forecastStates, pointToUsdRate))
        : getMerklBreakdownApr(breakdown, pointToUsdRate);
      return !isNaN(apr) && apr >= 0 ? apr : 0;
    },
  });
};

const sumMerklIncentiveApy = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds, options.campaignAccessStatuses?.[breakdown.campaignId]),
    mapValue: (_group, breakdown) => {
      const apr = options.forecastStates
        ? sanitizePercent(forecastMerklApr(breakdown, 0, options.forecastStates, pointToUsdRate))
        : getMerklBreakdownApr(breakdown, pointToUsdRate);
      return !isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0;
    },
  });
};

const sumBrevisIncentiveApr = (brevis?: BrevisIncentive[], forecastStates?: Record<string, MerklForecastWireItem>): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const resolved = getBrevisResolvedBreakdown(group, breakdown);
      const merkl = toMerklBreakdown(resolved);
      const apr = forecastStates
        ? sanitizePercent(forecastMerklApr(merkl, 0, forecastStates, 0))
        : sanitizePercent(resolved.campaignApr);
      return !isNaN(apr) && apr >= 0 ? apr : 0;
    },
  });
};

const sumBrevisIncentiveApy = (brevis?: BrevisIncentive[], forecastStates?: Record<string, MerklForecastWireItem>): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const resolved = getBrevisResolvedBreakdown(group, breakdown);
      const merkl = toMerklBreakdown(resolved);
      const apr = forecastStates
        ? sanitizePercent(forecastMerklApr(merkl, 0, forecastStates, 0))
        : sanitizePercent(resolved.campaignApr);
      return !isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0;
    },
  });
};

export const calculateTotalIncentiveApr = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApr = sumMeritIncentiveApr(meritIncentives);
  const merklApr = sumMerklIncentiveApr(merklOpportunities, tydroPointToUsdRate, options);
  const protocolApr = sumNumberArray(protocolIncentives);
  const brevisAprValue = sumBrevisIncentiveApr(brevisIncentives, options.forecastStates);

  return meritApr + merklApr + protocolApr + brevisAprValue;
};

export const calculateTotalIncentiveApy = (
  meritIncentives?: MeritIncentive[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApy = sumMeritIncentiveApy(meritIncentives);
  const merklApy = sumMerklIncentiveApy(merklOpportunities, tydroPointToUsdRate, options);

  let protocolApy = 0;
  if (protocolIncentives && Array.isArray(protocolIncentives)) {
    protocolIncentives.forEach(apr => {
      if (!isNaN(apr) && apr >= 0) {
        protocolApy += convertAprToApy(apr);
      }
    });
  }

  const brevisApy = sumBrevisIncentiveApy(brevisIncentives, options.forecastStates);

  return meritApy + merklApy + protocolApy + brevisApy;
};

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

export function formatForecastUnavailableLabel(
  ids: string[] | undefined,
  count: number,
): string {
  const resolvedIds = ids ?? [];
  const maxShow = 3;
  const shown = resolvedIds.slice(0, maxShow);
  const rest = resolvedIds.length - maxShow;
  const label = shown.length > 0
    ? `Campaign${shown.length > 1 ? 's' : ''} ${shown.map((id) => `#${id}`).join(', ')}${rest > 0 ? ` +${rest} more` : ''}`
    : `${count} campaign${count > 1 ? 's' : ''}`;
  return `${label} without forecast – using current APR.`;
}
