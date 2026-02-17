import type { PoolWithSpread, MerklOpportunityGroup } from '@/types/aave';

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
  pool: PoolWithSpread,
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
        label: `${pool.chainName} · ${pool.marketName} · ${pool.tokenSymbol} · ${actionType}${groupName}`,
        usesPointToUsdRate,
        tokenSymbol: pool.tokenSymbol,
        tokenAddress: pool.tokenAddress,
        aTokenAddress: pool.aTokenAddress,
        vTokenAddress: pool.vTokenAddress,
        chainId: pool.chainId,
      });
    });
  });
};

export const collectMerklCampaignOptions = (
  pools: PoolWithSpread[],
  config: CollectMerklCampaignOptionsConfig = {}
): MerklCampaignOption[] => {
  const byCampaignId = new Map<string, MerklCampaignOption>();
  const includeWhitelistOnly = config.includeWhitelistOnly === true;

  pools.forEach((pool) => {
    addFromGroups(byCampaignId, pool.merklSupplys, 'Supply', pool, includeWhitelistOnly);
    addFromGroups(byCampaignId, pool.merklBorrows, 'Borrow', pool, includeWhitelistOnly);
    addFromGroups(byCampaignId, pool.merklHolds, 'Hold', pool, includeWhitelistOnly);
  });

  return Array.from(byCampaignId.values()).sort((a, b) => a.campaignId.localeCompare(b.campaignId));
};
