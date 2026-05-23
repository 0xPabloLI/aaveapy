/**
 * DEAD CODE — do not use.
 *
 * This hook calls `/meta/campaign-access` which does not exist on the backend.
 * Per aav_66_plan.md, campaign access is embedded in `/api/meta/side-data.campaignAccess`.
 * Rewrite this hook to consume from useSideDataMeta() when implementing AAV-66.
 */
import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { CampaignAccessResponseSchema } from '@/lib/apiSchemas';
import type { CampaignAccessResponse } from '@/types/aave';

export const CAMPAIGN_ACCESS_QUERY_KEY = ['campaign-access'] as const;

export type CampaignAccessStatus = 'allowed' | 'whitelist-blocked' | 'blacklisted';

export async function fetchCampaignAccess(): Promise<CampaignAccessResponse> {
  const response = await fetch(`${API_BASE}/meta/campaign-access`);
  if (!response.ok) {
    throw new Error(`Failed to fetch campaign access (${response.status})`);
  }
  const raw = await response.json();
  return CampaignAccessResponseSchema.parse(raw) as CampaignAccessResponse;
}

/**
 * Check user's access status for a specific campaign.
 * Pure function — no side effects, no React dependency.
 *
 * @param userAddress - connected wallet address
 * @param campaignId - Merkl campaign ID
 * @param campaigns - campaign access data from API
 */
export function getUserCampaignStatus(
  userAddress: string,
  campaignId: string,
  campaigns: Record<string, { whitelist: string[]; blacklist: string[] }>,
): CampaignAccessStatus {
  const access = campaigns[campaignId];
  if (!access) return 'allowed'; // no access data = public campaign

  const addr = userAddress.toLowerCase();

  if (access.whitelist.length > 0) {
    return access.whitelist.includes(addr) ? 'allowed' : 'whitelist-blocked';
  }

  if (access.blacklist.includes(addr)) return 'blacklisted';

  return 'allowed';
}

/**
 * Hook to fetch Merkl campaign whitelist/blacklist data.
 * Gated by `enabled` — set to `true` only when wallet is connected.
 *
 * @param enabled - whether to fetch (wallet connected)
 */
export function useCampaignAccess(enabled: boolean) {
  return useQuery({
    queryKey: CAMPAIGN_ACCESS_QUERY_KEY,
    queryFn: fetchCampaignAccess,
    enabled,
    staleTime: QUERY_STALE_TIMES.campaignAccess,
  });
}