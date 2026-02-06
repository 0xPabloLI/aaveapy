import type { PoolWithSpread, MerklOpportunityGroup } from '@/types/aave';

export interface MerklCampaignOption {
  campaignId: string;
  label: string;
  actionType: 'Supply' | 'Borrow' | 'Hold';
  tokenSymbol: string;
  tokenAddress: string;
  chainId: number;
}

const addFromGroups = (
  byCampaignId: Map<string, MerklCampaignOption>,
  groups: MerklOpportunityGroup[] | undefined,
  actionType: MerklCampaignOption['actionType'],
  pool: PoolWithSpread
) => {
  if (!groups || groups.length === 0) return;
  groups.forEach((group) => {
    group.breakdowns?.forEach((breakdown) => {
      const campaignId = String(breakdown.campaignId || '').trim();
      if (!campaignId || byCampaignId.has(campaignId)) return;
      const groupName = group.name ? ` · ${group.name}` : '';
      byCampaignId.set(campaignId, {
        campaignId,
        actionType,
        label: `${pool.chainName} · ${pool.marketName} · ${pool.tokenSymbol} · ${actionType}${groupName}`,
        tokenSymbol: pool.tokenSymbol,
        tokenAddress: pool.tokenAddress,
        chainId: pool.chainId,
      });
    });
  });
};

export const collectMerklCampaignOptions = (pools: PoolWithSpread[]): MerklCampaignOption[] => {
  const byCampaignId = new Map<string, MerklCampaignOption>();

  pools.forEach((pool) => {
    addFromGroups(byCampaignId, pool.merklSupplys, 'Supply', pool);
    addFromGroups(byCampaignId, pool.merklBorrows, 'Borrow', pool);
    addFromGroups(byCampaignId, pool.merklHolds, 'Hold', pool);
  });

  return Array.from(byCampaignId.values()).sort((a, b) => a.campaignId.localeCompare(b.campaignId));
};
