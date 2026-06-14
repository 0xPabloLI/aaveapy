import type { BrevisIncentive } from '@/types/aave';
import { isCampaignActive } from '@/lib/campaignGroups';

type BrevisBreakdown = NonNullable<BrevisIncentive['breakdowns']>[number];

export type BrevisResolvedBreakdown = {
  name?: string;
  message?: string;
  link: string;
  campaignApr: number;
  campaignStartedAt?: string;
  campaignEndedAt?: string;
  latestTvl?: number;
  totalBudget?: number;
  perUserRewardCapUsd?: number;
  distributedSoFarUsd?: number;
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
  latestTvl: brevis.latestTvl,
  totalBudget: brevis.totalBudget,
  perUserRewardCapUsd: brevis.perUserRewardCapUsd,
  distributedSoFarUsd: brevis.distributedSoFarUsd,
  campaignId: brevis.campaignId,
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

export const getBrevisPerUserRewardCapUsd = (brevis: BrevisIncentive): number | undefined =>
  brevis.perUserRewardCapUsd;

export const getBrevisDistributedSoFarUsd = (brevis: BrevisIncentive): number | undefined =>
  brevis.distributedSoFarUsd;

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
  campaignStartedAt: firstNonEmptyString(breakdown?.campaignStartedAt, brevis.campaignStartedAt),
  campaignEndedAt: firstNonEmptyString(breakdown?.campaignEndedAt, brevis.campaignEndedAt),
  latestTvl: firstFiniteNumber(breakdown?.latestTvl, brevis.latestTvl),
  totalBudget: firstFiniteNumber(breakdown?.totalBudget, brevis.totalBudget),
  perUserRewardCapUsd: firstFiniteNumber(breakdown?.perUserRewardCapUsd, brevis.perUserRewardCapUsd),
  distributedSoFarUsd: firstFiniteNumber(breakdown?.distributedSoFarUsd, brevis.distributedSoFarUsd),
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
