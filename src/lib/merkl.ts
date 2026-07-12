import { isCampaignActive } from './campaignGroups';
import type { MerklOpportunityGroup } from '@/types/aave';

export const getFirstActiveMerklLink = (
  opportunities?: MerklOpportunityGroup[],
  nowMs = Date.now(),
): string | null => {
  if (!opportunities?.length) return null;
  for (const opp of opportunities) {
    if (!opp.link) continue;
    const hasActive = opp.breakdowns?.some((bd) =>
      isCampaignActive(bd.campaignStartedAt, bd.campaignEndedAt, nowMs, true),
    );
    if (hasActive) return opp.link;
  }
  return null;
};
