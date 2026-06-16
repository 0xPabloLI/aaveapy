import type { BrevisIncentive, MerklCampaignBreakdown } from '@/types/aave';
import { isCampaignActive } from '@/lib/campaignGroups';

type BrevisBreakdown = NonNullable<BrevisIncentive['breakdowns']>[number];

export type BrevisResolvedBreakdown = {
  name?: string;
  message?: string;
  link: string;
  campaignApr: number;
  campaignStartedAt: string;
  campaignEndedAt: string;
  campaignType?: string;
  aprCap?: number | null;
  latestTvl?: number;
  totalBudget?: number;
  positionCap?: number;
  campaignId?: string;
};

const firstFiniteNumber = (...values: Array<number | undefined>): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const firstNonEmptyString = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const makeSingleBreakdown = (brevis: BrevisIncentive): BrevisCampaignBreakdown => ({
  campaignApr: brevis.campaignApr ?? 0,
  campaignStartedAt: brevis.campaignStartedAt ?? '',
  campaignEndedAt: brevis.campaignEndedAt ?? '',
  campaignType: brevis.campaignType,
  aprCap: brevis.aprCap,
  latestTvl: brevis.latestTvl,
  totalBudget: brevis.totalBudget,
  positionCap: brevis.positionCap,
  campaignId: brevis.campaignId ?? '',
});

type BrevisCampaignBreakdown = NonNullable<BrevisIncentive['breakdowns']>[number];

export const getBrevisCampaignName = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.name);

export const getBrevisCampaignApr = (brevis: BrevisIncentive): number =>
  brevis.campaignApr ?? 0;

export const getBrevisCampaignStartedAt = (brevis: BrevisIncentive): string | undefined =>
  brevis.campaignStartedAt;

export const getBrevisCampaignEndedAt = (brevis: BrevisIncentive): string | undefined =>
  brevis.campaignEndedAt;

export const getBrevisCampaignMessage = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.message);

export const getBrevisDisplayLabel = (brevis: BrevisIncentive, fallback = 'Brevis'): string =>
  firstNonEmptyString(getBrevisCampaignName(brevis), getBrevisCampaignMessage(brevis)) ?? fallback;

export const getBrevisLatestTvl = (brevis: BrevisIncentive): number | undefined =>
  brevis.latestTvl;

export const getBrevisTotalBudget = (brevis: BrevisIncentive): number | undefined =>
  brevis.totalBudget;


export const getBrevisCampaignId = (brevis: BrevisIncentive): string | undefined =>
  brevis.campaignId;

export const getBrevisCampaignBreakdowns = (brevis: BrevisIncentive): BrevisCampaignBreakdown[] =>
  [makeSingleBreakdown(brevis)];

export const getBrevisResolvedBreakdown = (
  brevis: BrevisIncentive,
  breakdown?: BrevisBreakdown,
): BrevisResolvedBreakdown => ({
  name: getBrevisCampaignName(brevis),
  message: getBrevisCampaignMessage(brevis),
  link: brevis.link,
  campaignApr: firstFiniteNumber(breakdown?.campaignApr, brevis.campaignApr) ?? 0,
  campaignStartedAt: firstNonEmptyString(breakdown?.campaignStartedAt, brevis.campaignStartedAt) ?? '',
  campaignEndedAt: firstNonEmptyString(breakdown?.campaignEndedAt, brevis.campaignEndedAt) ?? '',
  campaignType: firstNonEmptyString(breakdown?.campaignType, brevis.campaignType),
  aprCap: breakdown?.aprCap ?? brevis.aprCap,
  latestTvl: firstFiniteNumber(breakdown?.latestTvl, brevis.latestTvl),
  totalBudget: firstFiniteNumber(breakdown?.totalBudget, brevis.totalBudget),
  positionCap: firstFiniteNumber(breakdown?.positionCap, brevis.positionCap),
  campaignId: firstNonEmptyString(breakdown?.campaignId, brevis.campaignId),
});

export const hasActiveBrevisBreakdown = (
  brevis: BrevisIncentive,
  nowMs = Date.now(),
  allowOpenEnd = true,
): boolean =>
  isCampaignActive(
    brevis.campaignStartedAt,
    brevis.campaignEndedAt,
    nowMs,
    allowOpenEnd,
  );

export const getFirstActiveBrevisLink = (
  brevisItems?: BrevisIncentive[],
  nowMs = Date.now(),
): string | null => {
  if (!brevisItems?.length) return null;
  for (const brevis of brevisItems) {
    if (brevis.link && hasActiveBrevisBreakdown(brevis, nowMs, true)) {
      return brevis.link;
    }
  }
  return null;
};

const BREVIS_FIX_TYPE = 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE';

export const toMerklBreakdown = (resolved: BrevisResolvedBreakdown): MerklCampaignBreakdown => ({
  campaignApr: resolved.campaignApr,
  campaignStartedAt: resolved.campaignStartedAt,
  campaignEndedAt: resolved.campaignEndedAt,
  campaignId: resolved.campaignId ?? '',
  campaignType: resolved.campaignType,
  aprCap: resolved.campaignType === BREVIS_FIX_TYPE
    ? (resolved.aprCap ?? resolved.campaignApr)
    : resolved.aprCap,
  latestTvl: resolved.latestTvl,
  totalBudget: resolved.totalBudget,
});
