import type { ReserveWithSpread, MerklOpportunityGroup } from '@/types/aave';

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
  includeWhitelistOnly?: boolean;
}

const addFromGroups = (
  byCampaignId: Map<string, MerklCampaignOption>,
  groups: MerklOpportunityGroup[] | undefined,
  actionType: MerklCampaignOption['actionType'],
  reserve: ReserveWithSpread,
  includeWhitelistOnly: boolean
) => {
  if (!groups || groups.length === 0) return;
  groups.forEach((group) => {
    group.breakdowns?.forEach((breakdown) => {
      if (breakdown.whitelistOnly && !includeWhitelistOnly) return;
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
  const includeWhitelistOnly = config.includeWhitelistOnly === true;

  reserves.forEach((reserve) => {
    addFromGroups(byCampaignId, reserve.merklSupplys, 'Supply', reserve, includeWhitelistOnly);
    addFromGroups(byCampaignId, reserve.merklBorrows, 'Borrow', reserve, includeWhitelistOnly);
    addFromGroups(byCampaignId, reserve.merklHolds, 'Hold', reserve, includeWhitelistOnly);
  });

  return Array.from(byCampaignId.values()).sort((a, b) => a.campaignId.localeCompare(b.campaignId));
};
