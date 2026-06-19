import { isCampaignActive } from './campaignGroups';
import type { MeritCampaignGroup } from '@/types/aave';

export const getFirstActiveMeritLink = (
  merits?: MeritCampaignGroup[],
  nowMs = Date.now(),
): string | null => {
  if (!merits?.length) return null;
  for (const group of merits) {
    if (group.link) {
      const hasActiveBreakdown = (group.breakdowns ?? []).some((b) =>
        isCampaignActive(b.campaignStartedAt, b.campaignEndedAt, nowMs, false),
      );
      if (hasActiveBreakdown) return group.link;
    }
  }
  return null;
};
