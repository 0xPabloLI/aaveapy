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
 * Hook that exposes the campaign-access payload and a resolver bound to it.
 *
 * The hook never gates the underlying request — side-data is always loaded —
 * but callers should gate UI surfacing on wallet connection state.
 */
export function useCampaignAccess() {
  const query = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);
  const payload = query.data?.campaignAccess;

  return {
    campaigns: payload?.campaigns,
    updatedAt: payload?.updatedAt,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getUserStatus: (userAddress: string, campaignId: string): CampaignAccessStatus =>
      getUserCampaignStatus(userAddress, campaignId, payload?.campaigns),
  };
}
