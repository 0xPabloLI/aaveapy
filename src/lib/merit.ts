import { isCampaignActive } from './campaignGroups';
import type { MeritIncentive } from '@/types/aave';

export const getFirstActiveMeritLink = (
  merits?: MeritIncentive[],
  nowMs = Date.now(),
): string | null => {
  if (!merits?.length) return null;
  for (const merit of merits) {
    if (merit.link && isCampaignActive(merit.startDate, merit.endDate, nowMs, false)) {
      return merit.link;
    }
  }
  return null;
};
