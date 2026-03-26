import type { BrevisIncentive } from '@/types/aave';

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

export const getBrevisCampaignApr = (brevis: BrevisIncentive): number =>
  firstFiniteNumber(brevis.campaignApr) ?? 0;

export const getBrevisCampaignStartedAt = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.campaignStartedAt);

export const getBrevisCampaignEndedAt = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.campaignEndedAt);

export const getBrevisCampaignMessage = (brevis: BrevisIncentive): string | undefined =>
  firstNonEmptyString(brevis.message);

export const getBrevisLatestTvl = (brevis: BrevisIncentive): number | undefined =>
  firstFiniteNumber(brevis.latestTvl);

export const getBrevisTotalBudget = (brevis: BrevisIncentive): number | undefined =>
  firstFiniteNumber(brevis.totalBudget);
