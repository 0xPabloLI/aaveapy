import type { BrevisIncentive, MeritIncentive, MerklOpportunityGroup } from '@/types/aave';
import { isCampaignActive, sumActiveCampaignBreakdownValues } from '@/lib/campaignGroups';
import {
  getBrevisCampaignBreakdowns,
  getBrevisResolvedBreakdown,
} from '@/lib/brevis';
import { TYDRO_POINT_TO_USD_RATE, getMerklBreakdownApr } from '@/lib/tydro';
import { convertAprToApy } from '@/lib/formatters';
import { isMerklWhitelistBreakdownIncluded } from '@/lib/formatters';

const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

export interface IncentiveAggregationOptions {
  isApy?: boolean;
  /** Merkl campaign IDs the user opted into for whitelist-only APR */
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  /** Point-to-USD conversion rate for Merkl points campaigns */
  tydroPointToUsdRate?: number;
}

export function aggregateMeritIncentiveApr(
  meritIncentives?: MeritIncentive[],
  options: IncentiveAggregationOptions = {},
): number {
  if (!meritIncentives?.length) return 0;
  const { isApy = false } = options;
  return meritIncentives.reduce((sum, incentive) => {
    if (!isCampaignActive(incentive.startDate, incentive.endDate)) return sum;
    const apr = sanitizePercent(incentive.apr);
    const selfApr = sanitizePercent(incentive.selfApr ?? 0);
    if (isApy) {
      return sum + (apr > 0 ? convertAprToApy(apr) : 0) + (selfApr > 0 ? convertAprToApy(selfApr) : 0);
    }
    return sum + apr + selfApr;
  }, 0);
}

export function aggregateMerklOpportunityApr(
  opportunities?: MerklOpportunityGroup[],
  options: IncentiveAggregationOptions = {},
): number {
  const {
    isApy = false,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate = TYDRO_POINT_TO_USD_RATE,
  } = options;
  return sumActiveCampaignBreakdownValues(opportunities, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    include: (_group, breakdown) => isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds),
    mapValue: (_group, breakdown) => {
      const apr = sanitizePercent(getMerklBreakdownApr(breakdown, tydroPointToUsdRate));
      return isApy ? convertAprToApy(apr) : apr;
    },
  });
}

export function aggregateBrevisIncentiveApr(
  brevis?: BrevisIncentive[],
  options: IncentiveAggregationOptions = {},
): number {
  const { isApy = false } = options;
  return sumActiveCampaignBreakdownValues(brevis, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const apr = sanitizePercent(getBrevisResolvedBreakdown(group, breakdown).campaignApr);
      return isApy ? convertAprToApy(apr) : apr;
    },
  });
}
