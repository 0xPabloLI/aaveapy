/**
 * useCampaignAccess — consume Merkl whitelist/blacklist (AAV-66).
 *
 * Data source: `/api/meta/side-data.campaignAccess`, fetched via useSideDataMeta().
 * No separate network request — piggybacks on the side-data query that the app
 * already loads on first render.
 *
 * Backend does NOT lowercase addresses; this hook normalizes defensively on both
 * sides of the comparison.
 */
import { useMemo } from 'react';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { useSideDataMeta } from './useSideDataMeta';
import type { CampaignAccessEntry } from '@/types/aave';

export type CampaignAccessStatus = 'allowed' | 'whitelist-blocked' | 'blacklisted';

/**
 * Pure resolver — no React dependency. Safe to use in selectors and tests.
 *
 * Semantics:
 * - No entry for this campaign → public campaign → 'allowed'
 * - Non-empty whitelist → only listed addresses are 'allowed'; others 'whitelist-blocked'
 * - Empty whitelist + blacklist hit → 'blacklisted'
 * - Otherwise → 'allowed'
 */
export function getUserCampaignStatus(
  userAddress: string,
  campaignId: string,
  campaigns: Record<string, CampaignAccessEntry> | undefined,
): CampaignAccessStatus {
  if (!campaigns) return 'allowed';

  const access = campaigns[campaignId];
  if (!access) return 'allowed';

  const addr = userAddress.toLowerCase();

  if (access.whitelist.length > 0) {
    const allowed = access.whitelist.some((entry) => entry.toLowerCase() === addr);
    return allowed ? 'allowed' : 'whitelist-blocked';
  }

  if (access.blacklist.some((entry) => entry.toLowerCase() === addr)) {
    return 'blacklisted';
  }

  return 'allowed';
}

/**
 * Compute per-campaign access status for a user, covering all campaigns in the payload.
 * Returns undefined when campaigns or userAddress is unavailable (no wallet connected).
 */
export function computeCampaignAccessStatuses(
  userAddress: string | undefined,
  campaigns: Record<string, CampaignAccessEntry> | undefined,
): Record<string, CampaignAccessStatus> | undefined {
  if (!userAddress) return undefined;
  if (!campaigns) return undefined;
  const result: Record<string, CampaignAccessStatus> = {};
  for (const campaignId of Object.keys(campaigns)) {
    result[campaignId] = getUserCampaignStatus(userAddress, campaignId, campaigns);
  }
  return result;
}

/**
 * Hook that exposes the campaign-access payload and a per-campaign status map for
 * the connected wallet. The underlying side-data request is never gated — side-data
 * is always loaded — but `campaignAccessStatuses` is only computed when a wallet
 * address is available.
 */
export function useCampaignAccess(userAddress?: string) {
  const query = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);
  const payload = query.data?.campaignAccess;
  const campaigns = payload?.campaigns;

  const campaignAccessStatuses = useMemo(
    () => computeCampaignAccessStatuses(userAddress, campaigns),
    [userAddress, campaigns],
  );

  return {
    campaigns,
    campaignAccessStatuses,
    updatedAt: payload?.updatedAt,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getUserStatus: (addr: string, campaignId: string): CampaignAccessStatus =>
      getUserCampaignStatus(addr, campaignId, payload?.campaigns),
  };
}
