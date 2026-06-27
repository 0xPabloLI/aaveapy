import { parseCampaignBoundaryMs } from './campaignGroups';
import { getIncentiveSources } from './incentiveAggregation';
import type { ReserveWithSpread } from '@/types/aave';

export const DEFAULT_LOOKBACK_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isRecentlyEnded(
  endDate: string | undefined,
  nowMs = Date.now(),
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): boolean {
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (endMs === null) return false;
  const lookbackMs = lookbackDays * MS_PER_DAY;
  return endMs >= nowMs - lookbackMs && endMs < nowMs;
}

export interface RecentlyEndedSource {
  sourceType: 'merit' | 'merkl' | 'brevis';
  name: string;
  link: string;
  campaigns: RecentlyEndedCampaign[];
}

export interface RecentlyEndedCampaign {
  apr: number;
  endDate: string;
  startDate?: string;
  message?: unknown;
  name?: string;
  campaignId?: string;
}

export function collectRecentlyEndedCampaigns(
  reserve: ReserveWithSpread,
  supplyOrBorrow: 'supply' | 'borrow',
  nowMs = Date.now(),
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): RecentlyEndedSource[] {
  const sources: RecentlyEndedSource[] = [];

  const { merit: meritList, merkl: merklList, brevis: brevisList } = getIncentiveSources(reserve, supplyOrBorrow);
  if (meritList && Array.isArray(meritList)) {
    for (const group of meritList) {
      const breakdowns = group.breakdowns ?? [];
      const endedBreakdowns = breakdowns.filter((b) =>
        isRecentlyEnded(b.campaignEndedAt, nowMs, lookbackDays),
      );
      if (endedBreakdowns.length === 0) continue;

      const campaigns: RecentlyEndedCampaign[] = endedBreakdowns.map((b) => ({
        apr: b.campaignApr,
        endDate: b.campaignEndedAt,
        startDate: b.campaignStartedAt,
        message: group.message,
        name: group.name,
        campaignId: b.campaignId,
      }));

      sources.push({
        sourceType: 'merit',
        name: group.name || 'ACI Incentive',
        link: group.link || '',
        campaigns,
      });
    }
  }

  if (merklList && Array.isArray(merklList)) {
    for (const group of merklList) {
      if (!group.breakdowns?.length) continue;

      const endedBreakdowns = group.breakdowns.filter((b) =>
        isRecentlyEnded(b.campaignEndedAt, nowMs, lookbackDays),
      );

      if (endedBreakdowns.length === 0) continue;

      const campaigns: RecentlyEndedCampaign[] = endedBreakdowns.map((b) => ({
        apr: b.campaignApr,
        endDate: b.campaignEndedAt,
        startDate: b.campaignStartedAt,
        campaignId: b.campaignId,
      }));

      sources.push({
        sourceType: 'merkl',
        name: group.name || 'Merkl Campaign',
        link: group.link || '',
        campaigns,
      });
    }
  }

  if (brevisList && Array.isArray(brevisList)) {
    for (const brevis of brevisList) {
      const brevisBreakdowns = brevis.breakdowns ?? [];

      if (brevisBreakdowns.length > 0) {
        const endedBreakdowns = brevisBreakdowns.filter((b) =>
          isRecentlyEnded(b.campaignEndedAt, nowMs, lookbackDays),
        );

        if (endedBreakdowns.length === 0) continue;

        const campaigns: RecentlyEndedCampaign[] = endedBreakdowns.map((b) => ({
          apr: b.campaignApr,
          endDate: b.campaignEndedAt,
          startDate: b.campaignStartedAt,
          campaignId: b.campaignId,
        }));

        sources.push({
          sourceType: 'brevis',
          name: brevis.name || 'Brevis Incentive',
          link: brevis.link,
          campaigns,
        });
      } else if (brevis.campaignEndedAt && isRecentlyEnded(brevis.campaignEndedAt, nowMs, lookbackDays)) {
        sources.push({
          sourceType: 'brevis',
          name: brevis.name || 'Brevis Incentive',
          link: brevis.link,
          campaigns: [
            {
              apr: brevis.campaignApr ?? 0,
              endDate: brevis.campaignEndedAt,
              startDate: brevis.campaignStartedAt,
              campaignId: brevis.campaignId,
            },
          ],
        });
      }
    }
  }

  return sources;
}