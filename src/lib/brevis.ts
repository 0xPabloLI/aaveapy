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

const resolveBrevisCampaignBreakdowns = (brevis: BrevisIncentive) => {
  if (Array.isArray(brevis.breakdowns) && brevis.breakdowns.length > 0) {
    return brevis.breakdowns;
  }
  if (
    brevis.campaignApr === undefined &&
    brevis.campaignStartedAt === undefined &&
    brevis.campaignEndedAt === undefined &&
    brevis.latestTvl === undefined &&
    brevis.totalBudget === undefined &&
    brevis.perUserRewardCapUsd === undefined &&
    brevis.campaignId === undefined
  ) {
    return [];
  }
  return [{
    campaignApr: brevis.campaignApr ?? 0,
    campaignStartedAt: brevis.campaignStartedAt ?? '',
    campaignEndedAt: brevis.campaignEndedAt ?? '',
    latestTvl: brevis.latestTvl,
    totalBudget: brevis.totalBudget,
    perUserRewardCapUsd: brevis.perUserRewardCapUsd,
    campaignId: brevis.campaignId,
  }];
};

const getBrevisPrimaryBreakdown = (brevis: BrevisIncentive) => resolveBrevisCampaignBreakdowns(brevis)[0];

export const getBrevisCampaignName = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.name);

export const getBrevisCampaignApr = (brevis: BrevisIncentive): number =>
  firstFiniteNumber(brevis.campaignApr, getBrevisPrimaryBreakdown(brevis)?.campaignApr) ?? 0;

export const getBrevisCampaignStartedAt = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.campaignStartedAt, getBrevisPrimaryBreakdown(brevis)?.campaignStartedAt);

export const getBrevisCampaignEndedAt = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.campaignEndedAt, getBrevisPrimaryBreakdown(brevis)?.campaignEndedAt);

export const getBrevisCampaignMessage = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.message);

export const getBrevisDisplayLabel = (brevis: BrevisIncentive, fallback = 'Brevis'): string =>
  firstNonEmptyString(getBrevisCampaignName(brevis), getBrevisCampaignMessage(brevis)) ?? fallback;

export const getBrevisLatestTvl = (brevis: BrevisIncentive): number | undefined =>
  firstFiniteNumber(brevis.latestTvl, getBrevisPrimaryBreakdown(brevis)?.latestTvl);

export const getBrevisTotalBudget = (brevis: BrevisIncentive): number | undefined =>
  firstFiniteNumber(brevis.totalBudget, getBrevisPrimaryBreakdown(brevis)?.totalBudget);

export const getBrevisPerUserRewardCapUsd = (brevis: BrevisIncentive): number | undefined =>
  firstFiniteNumber(brevis.perUserRewardCapUsd, getBrevisPrimaryBreakdown(brevis)?.perUserRewardCapUsd);

export const getBrevisCampaignId = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.campaignId, getBrevisPrimaryBreakdown(brevis)?.campaignId);

export const getBrevisCampaignBreakdowns = (brevis: BrevisIncentive) => resolveBrevisCampaignBreakdowns(brevis);

export const getBrevisResolvedBreakdown = (
  brevis: BrevisIncentive,
  breakdown?: BrevisBreakdown,
): BrevisResolvedBreakdown => ({
  name: getBrevisCampaignName(brevis),
  message: getBrevisCampaignMessage(brevis),
  link: brevis.link,
  campaignApr: firstFiniteNumber(breakdown?.campaignApr, brevis.campaignApr) ?? 0,
  campaignStartedAt: firstNonEmptyString(breakdown?.campaignStartedAt, getBrevisCampaignStartedAt(brevis)),
  campaignEndedAt: firstNonEmptyString(breakdown?.campaignEndedAt, getBrevisCampaignEndedAt(brevis)),
  latestTvl: firstFiniteNumber(breakdown?.latestTvl, getBrevisLatestTvl(brevis)),
  totalBudget: firstFiniteNumber(breakdown?.totalBudget, getBrevisTotalBudget(brevis)),
  perUserRewardCapUsd: firstFiniteNumber(breakdown?.perUserRewardCapUsd, getBrevisPerUserRewardCapUsd(brevis)),
  campaignId: firstNonEmptyString(breakdown?.campaignId, getBrevisCampaignId(brevis)),
});

export const hasActiveBrevisBreakdown = (
  brevis: BrevisIncentive,
  nowMs = Date.now(),
  allowOpenEnd = true,
): boolean =>
  getBrevisCampaignBreakdowns(brevis).some((breakdown) => {
    const resolved = getBrevisResolvedBreakdown(brevis, breakdown);
    return isCampaignActive(
      resolved.campaignStartedAt,
      resolved.campaignEndedAt,
      nowMs,
      allowOpenEnd,
    );
  });

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
