import type { BrevisIncentive, MeritCampaignGroup, MerklOpportunityGroup } from '@/types/aave';
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
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  tydroPointToUsdRate?: number;
}

export function aggregateMeritIncentiveApr(
  meritGroups?: MeritCampaignGroup[],
  options: IncentiveAggregationOptions = {},
): number {
  const { isApy = false } = options;
  return sumActiveCampaignBreakdownValues(meritGroups, {
    getBreakdowns: (group) => group.breakdowns,
    getStartDate: (_group, breakdown) => breakdown.campaignStartedAt,
    getEndDate: (_group, breakdown) => breakdown.campaignEndedAt,
    mapValue: (_group, breakdown) => {
      const apr = sanitizePercent(breakdown.campaignApr);
      return isApy && apr > 0 ? convertAprToApy(apr) : apr;
    },
  });
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
