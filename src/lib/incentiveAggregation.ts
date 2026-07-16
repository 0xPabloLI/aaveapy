import {
  type BrevisIncentive,
  type MeritCampaignGroup,
  type MerklOpportunityGroup,
  type ReserveWithSpread,
  MerklForecastWireItem } from '@/types/aave';
import { isCampaignActive, sumActiveCampaignBreakdownValues } from '@/lib/campaignGroups';
import {
  getBrevisCampaignBreakdowns,
  getBrevisResolvedBreakdown,
} from '@/lib/brevis';
import { TYDRO_POINT_TO_USD_RATE, getPointToUsdRate, type PointRateMap } from '@/lib/tydro';
import { getMerklBreakdownApr, forecastMerklApr, sanitizePercent } from '@/lib/merklForecast';
import { convertAprToApy } from '@/lib/rateCalculations';
import { isMerklWhitelistBreakdownIncluded } from '@/lib/merklWhitelist';
import { applyPositionCapToForecastResult, resolvePositionCapUsd } from '@/lib/incentiveCaps';

export interface IncentiveCalculationOptions {
  /** Merkl campaign IDs the user opted into for whitelist-only APR */
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  /** When provided, enables forecastWithTVL-based fallback for campaigns where getMerklBreakdownApr returns 0. */
  forecastStates?: Record<string, MerklForecastWireItem>;
  /** Per-campaignId access status from /meta/side-data.campaignAccess (AAV-66). */
  campaignAccessStatuses?: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'>;
  /** Per-symbol point rate map for per-campaign rate routing (AAV-898). */
  pointRateMap?: PointRateMap;
  /** Per-group multiplier for Merkl opportunity groups (e.g., cross-reserve eligibility). AAV-980 */
  merklGroupMultiplier?: (group: MerklOpportunityGroup) => number;
  /** User's total position in USD for position cap dilution (Merkl maxDeposit campaigns). */
  positionUsd?: number;
  /** Reserve token price for converting positionCapNative to USD (Merkl). */
  tokenPrice?: number;
  /** Reserve token decimals for converting positionCapNative to USD (Merkl). */
  decimals?: number;
  /** Per-group net eligible USD after cross-reserve offset. When provided, cap and offset compose as single eligible principal: eligible = min(netEligible, cap), rate = apr * eligible / grossPosition. AAV-1164 */
  crossReserveNetEligibleUsd?: (group: MerklOpportunityGroup) => number;
}

export interface IncentiveSources {
  protocol?: number[];
  merit?: MeritCampaignGroup[];
  merkl?: MerklOpportunityGroup[];
  brevis?: BrevisIncentive[];
}

export function getIncentiveSources(
  reserve: ReserveWithSpread,
  side: 'supply' | 'borrow',
): IncentiveSources {
  return {
    protocol: side === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives,
    merit: side === 'supply' ? reserve.meritSupplys : reserve.meritBorrows,
    merkl: side === 'supply' ? reserve.merklSupplys : reserve.merklBorrows,
    brevis: side === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows,
  };
}

const sumNumberArray = (arr?: number[]): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((sum, val) => {
    return (!isNaN(val) && val >= 0) ? sum + val : sum;
  }, 0);
};

export const sumMeritIncentiveApr = (meritGroups?: MeritCampaignGroup[]): number => {
  return sumActiveCampaignBreakdownValues(meritGroups, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, b) => b.campaignStartedAt,
    getEndDate: (_group, b) => b.campaignEndedAt,
    include: () => true,
    mapValue: (_group, b) => !isNaN(b.campaignApr) && b.campaignApr >= 0 ? b.campaignApr : 0,
  });
};

const sumMeritIncentiveApy = (meritGroups?: MeritCampaignGroup[]): number => {
  return sumActiveCampaignBreakdownValues(meritGroups, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, b) => b.campaignStartedAt,
    getEndDate: (_group, b) => b.campaignEndedAt,
    include: () => true,
    mapValue: (_group, b) => {
      const apr = !isNaN(b.campaignApr) && b.campaignApr >= 0 ? b.campaignApr : 0;
      return convertAprToApy(apr);
    },
  });
};

export const sumMerklIncentiveApr = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const { pointRateMap, positionUsd, tokenPrice, decimals } = options;
  const useUnifiedEligibility = options.crossReserveNetEligibleUsd != null;
  const applyUnifiedInMapValue = useUnifiedEligibility && positionUsd != null && positionUsd > 0;
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds, options.campaignAccessStatuses?.[breakdown.campaignId]),
    mapValue: (group, breakdown) => {
      const effectiveRate = pointRateMap
        ? getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)
        : pointToUsdRate;
      let apr = options.forecastStates
        ? sanitizePercent(forecastMerklApr(breakdown, 0, options.forecastStates, effectiveRate))
        : getMerklBreakdownApr(breakdown, effectiveRate);
      const effectiveCapUsd = resolvePositionCapUsd(breakdown.positionCapNative, breakdown.positionCapUsd, tokenPrice, decimals);
      if (applyUnifiedInMapValue) {
        // AAV-1164: Unified eligibility — cap and offset compose as single eligible principal.
        // eligible = min(netEligible, cap), rate = apr * eligible / grossPosition
        const netEligible = Math.max(options.crossReserveNetEligibleUsd!(group), 0);
        const eligible = effectiveCapUsd != null && effectiveCapUsd > 0
          ? Math.min(netEligible, effectiveCapUsd)
          : netEligible;
        apr = apr * eligible / positionUsd!;
      } else if (!isNaN(apr) && apr >= 0 && effectiveCapUsd != null && effectiveCapUsd > 0 && positionUsd != null && positionUsd > 0) {
        apr = applyPositionCapToForecastResult(apr, positionUsd, effectiveCapUsd, { isCombineCap: breakdown.isCombineCap ?? false }).aprPercent;
      }
      return !isNaN(apr) && apr >= 0 ? apr : 0;
    },
    // AAV-1164: Don't apply groupMultiplier when unified eligibility handles offset in mapValue.
    // When positionUsd is null, fall back to groupMultiplier for offset-only application.
    groupMultiplier: applyUnifiedInMapValue ? undefined : options.merklGroupMultiplier,
  });
};

export const sumMerklIncentiveApy = (
  opportunities?: MerklOpportunityGroup[],
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const { pointRateMap, positionUsd, tokenPrice, decimals } = options;
  const useUnifiedEligibility = options.crossReserveNetEligibleUsd != null;
  const applyUnifiedInMapValue = useUnifiedEligibility && positionUsd != null && positionUsd > 0;
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, options.whitelistMerklCampaignIds, options.campaignAccessStatuses?.[breakdown.campaignId]),
    mapValue: (group, breakdown) => {
      const effectiveRate = pointRateMap
        ? getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)
        : pointToUsdRate;
      let apr = options.forecastStates
        ? sanitizePercent(forecastMerklApr(breakdown, 0, options.forecastStates, effectiveRate))
        : getMerklBreakdownApr(breakdown, effectiveRate);
      const effectiveCapUsd = resolvePositionCapUsd(breakdown.positionCapNative, breakdown.positionCapUsd, tokenPrice, decimals);
      if (applyUnifiedInMapValue) {
        // AAV-1164: Unified eligibility — cap and offset compose as single eligible principal.
        const netEligible = Math.max(options.crossReserveNetEligibleUsd!(group), 0);
        const eligible = effectiveCapUsd != null && effectiveCapUsd > 0
          ? Math.min(netEligible, effectiveCapUsd)
          : netEligible;
        apr = apr * eligible / positionUsd!;
      } else if (!isNaN(apr) && apr >= 0 && effectiveCapUsd != null && effectiveCapUsd > 0 && positionUsd != null && positionUsd > 0) {
        apr = applyPositionCapToForecastResult(apr, positionUsd, effectiveCapUsd, { isCombineCap: breakdown.isCombineCap ?? false }).aprPercent;
      }
      return !isNaN(apr) && apr >= 0 ? convertAprToApy(apr) : 0;
    },
    // AAV-1164: Don't apply groupMultiplier when unified eligibility handles offset in mapValue.
    // When positionUsd is null, fall back to groupMultiplier for offset-only application.
    groupMultiplier: applyUnifiedInMapValue ? undefined : options.merklGroupMultiplier,
  });
};

export const resolveBrevisCurrentApr = (
  resolved: ReturnType<typeof getBrevisResolvedBreakdown>,
  forecastStates?: Record<string, MerklForecastWireItem>,
): number => {
  const apr = forecastStates
    ? sanitizePercent(forecastMerklApr(resolved, 0, forecastStates, 0))
    : sanitizePercent(resolved.campaignApr);
  return !isNaN(apr) && apr >= 0 ? apr : 0;
};

export const sumBrevisIncentiveApr = (brevis?: BrevisIncentive[], forecastStates?: Record<string, MerklForecastWireItem>): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const resolved = getBrevisResolvedBreakdown(group, breakdown);
      return resolveBrevisCurrentApr(resolved, forecastStates);
    },
  });
};

export const sumBrevisIncentiveApy = (brevis?: BrevisIncentive[], forecastStates?: Record<string, MerklForecastWireItem>): number => {
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const resolved = getBrevisResolvedBreakdown(group, breakdown);
      const apr = resolveBrevisCurrentApr(resolved, forecastStates);
      return apr > 0 ? convertAprToApy(apr) : 0;
    },
  });
};

export const calculateTotalIncentiveApr = (
  meritGroups?: MeritCampaignGroup[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApr = sumMeritIncentiveApr(meritGroups);
  const merklApr = sumMerklIncentiveApr(merklOpportunities, tydroPointToUsdRate, options);
  const protocolApr = sumNumberArray(protocolIncentives);
  const brevisAprValue = sumBrevisIncentiveApr(brevisIncentives, options.forecastStates);

  return meritApr + merklApr + protocolApr + brevisAprValue;
};

export const calculateTotalIncentiveApy = (
  meritGroups?: MeritCampaignGroup[],
  merklOpportunities?: MerklOpportunityGroup[],
  brevisIncentives?: BrevisIncentive[],
  protocolIncentives?: number[],
  tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  options: IncentiveCalculationOptions = {}
): number => {
  const meritApy = sumMeritIncentiveApy(meritGroups);
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
  const { protocol: protocolIncentives, merit: meritGroups, merkl: merklOpportunities, brevis: brevisIncentives } = getIncentiveSources(reserve, side);

  return {
    apr: calculateTotalIncentiveApr(
      meritGroups,
      merklOpportunities,
      brevisIncentives,
      protocolIncentives,
      tydroPointToUsdRate,
      options
    ),
    apy: calculateTotalIncentiveApy(
      meritGroups,
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
  pointRateMap?: PointRateMap,
): boolean {
  const { protocol: protocolIncentives, merit: meritGroups, merkl: opportunities, brevis: brevisIncentives } = getIncentiveSources(reserve, side);
  if (protocolIncentives && protocolIncentives.length > 0) {
    return true;
  }

  if (meritGroups?.length) {
    const meritApr = sumActiveCampaignBreakdownValues(meritGroups, {
      getBreakdowns: (group) => group.breakdowns,
      getStartDate: (_group, b) => b.campaignStartedAt,
      getEndDate: (_group, b) => b.campaignEndedAt,
      include: () => true,
      mapValue: (_group, b) => !isNaN(b.campaignApr) && b.campaignApr >= 0 ? b.campaignApr : 0,
    });
    if (meritApr > 0) return true;
  }

  if (brevisIncentives?.length) {
    for (const brevis of brevisIncentives) {
      const resolved = getBrevisResolvedBreakdown(brevis);
      if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) continue;
      const apr = resolved.campaignApr;
      if (!isNaN(apr) && apr >= 0) return true;
    }
  }

  if (opportunities?.length) {
    for (const opportunity of opportunities) {
      for (const breakdown of opportunity.breakdowns ?? []) {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) continue;
        const effectiveRate = pointRateMap
          ? getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)
          : tydroPointToUsdRate;
        const apr = getMerklBreakdownApr(breakdown, effectiveRate);
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
  pointRateMap?: PointRateMap,
): number | null {
  if (rawIncentive === null || Number.isNaN(rawIncentive) || rawIncentive < 0) return null;
  if (rawIncentive > 0) return rawIncentive;
  if (rawIncentive === 0 && reserveHasIncentiveTooltipSources(reserve, side, isApy, tydroPointToUsdRate, pointRateMap)) {
    return rawIncentive;
  }
  return null;
}
