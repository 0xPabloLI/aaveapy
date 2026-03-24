import type { ReserveWithSpread, MerklOpportunityGroup } from '@/types/aave';
import { isMerklWhitelistBreakdownIncluded } from '@/lib/formatters';

export interface MerklCampaignOption {
  campaignId: string;
  label: string;
  actionType: 'Supply' | 'Borrow' | 'Hold';
  usesPointToUsdRate: boolean;
  tokenSymbol: string;
  tokenAddress: string;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
  chainId: number;
}

interface CollectMerklCampaignOptionsConfig {
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  activeOnly?: boolean;
}

export interface WhitelistOnlyMerklCampaignEntry {
  campaignId: string;
  label: string;
}

/**
 * Active whitelist-only Merkl campaigns across reserves (deduped by campaignId) for preference UI.
 */
export const collectWhitelistOnlyMerklCampaignEntries = (
  reserves: ReserveWithSpread[]
): WhitelistOnlyMerklCampaignEntry[] => {
  const byId = new Map<string, string>();

  const visit = (
    groups: MerklOpportunityGroup[] | undefined,
    actionType: MerklCampaignOption['actionType'],
    reserve: ReserveWithSpread
  ) => {
    if (!groups) return;
    groups.forEach((group) => {
      group.breakdowns?.forEach((breakdown) => {
        if (!breakdown.whitelistOnly) return;
        if (!isBreakdownActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
        const campaignId = String(breakdown.campaignId || '').trim();
        if (!campaignId) return;
        const groupName = group.name ? ` · ${group.name}` : '';
        const label = `${reserve.chainName} · ${reserve.marketName} · ${reserve.tokenSymbol} · ${actionType}${groupName} · ${campaignId}`;
        if (!byId.has(campaignId)) {
          byId.set(campaignId, label);
        }
      });
    });
  };

  reserves.forEach((reserve) => {
    visit(reserve.merklSupplys, 'Supply', reserve);
    visit(reserve.merklBorrows, 'Borrow', reserve);
    visit(reserve.merklHolds, 'Hold', reserve);
  });

  return Array.from(byId.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([campaignId, label]) => ({ campaignId, label }));
};

const isBreakdownActive = (start?: string, end?: string, nowMs = Date.now()): boolean => {
  if (!start || !end) return false;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  return nowMs >= startMs && nowMs <= endMs;
};

const addFromGroups = (
  byCampaignId: Map<string, MerklCampaignOption>,
  groups: MerklOpportunityGroup[] | undefined,
  actionType: MerklCampaignOption['actionType'],
  reserve: ReserveWithSpread,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  activeOnly: boolean
) => {
  if (!groups || groups.length === 0) return;
  groups.forEach((group) => {
    group.breakdowns?.forEach((breakdown) => {
      if (!isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds)) return;
      if (activeOnly && !isBreakdownActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
      const campaignId = String(breakdown.campaignId || '').trim();
      if (!campaignId) return;
      const usesPointToUsdRate =
        typeof breakdown.pointsPerThousandUsd === 'number' && Number.isFinite(breakdown.pointsPerThousandUsd);
      const existing = byCampaignId.get(campaignId);
      if (existing) {
        if (usesPointToUsdRate && !existing.usesPointToUsdRate) {
          byCampaignId.set(campaignId, {
            ...existing,
            usesPointToUsdRate: true,
          });
        }
        return;
      }
      const groupName = group.name ? ` · ${group.name}` : '';
      byCampaignId.set(campaignId, {
        campaignId,
        actionType,
        label: `${reserve.chainName} · ${reserve.marketName} · ${reserve.tokenSymbol} · ${actionType}${groupName}`,
        usesPointToUsdRate,
        tokenSymbol: reserve.tokenSymbol,
        tokenAddress: reserve.tokenAddress,
        aTokenAddress: reserve.aTokenAddress,
        vTokenAddress: reserve.vTokenAddress,
        chainId: reserve.chainId,
      });
    });
  });
};

export const collectMerklCampaignOptions = (
  reserves: ReserveWithSpread[],
  config: CollectMerklCampaignOptionsConfig = {}
): MerklCampaignOption[] => {
  const byCampaignId = new Map<string, MerklCampaignOption>();
  const activeOnly = config.activeOnly === true;

  reserves.forEach((reserve) => {
    addFromGroups(byCampaignId, reserve.merklSupplys, 'Supply', reserve, config.whitelistMerklCampaignIds, activeOnly);
    addFromGroups(byCampaignId, reserve.merklBorrows, 'Borrow', reserve, config.whitelistMerklCampaignIds, activeOnly);
    addFromGroups(byCampaignId, reserve.merklHolds, 'Hold', reserve, config.whitelistMerklCampaignIds, activeOnly);
  });

  return Array.from(byCampaignId.values()).sort((a, b) => a.campaignId.localeCompare(b.campaignId));
};
