/**
 * Opt-in key for whitelist-only Merkl breakdowns that have no usable `campaignId` (empty after trim).
 * Stored in `whitelistMerklCampaignIds` alongside real Merkl campaign ids.
 */
export const MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL = '__merklWhitelistNoCampaignId__' as const;

/** Visible label next to Merkl whitelist-only opt-in (tooltip + forecast panel). */
export const MERKL_WHITELIST_TOGGLE_LABEL = 'Include as WL user';

/**
 * Accessible name for the opt-in control: checked = include this campaign in totals as a WL participant.
 */
export const MERKL_WHITELIST_TOGGLE_ARIA =
  'Include this Merkl campaign in incentive totals. Confirm you are a whitelist participant for this campaign.';

/**
 * Whether a Merkl breakdown should count toward incentive totals.
 * Non-whitelist campaigns always count; whitelist-only counts only when the user enabled this campaignId,
 * or the sentinel when there is no campaign id.
 */
export function isMerklWhitelistBreakdownIncluded(
  breakdown: { whitelistOnly?: boolean; campaignId: string },
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined
): boolean {
  if (!breakdown.whitelistOnly) return true;
  const id = String(breakdown.campaignId || '').trim();
  if (!id) {
    return Boolean(whitelistMerklCampaignIds?.has(MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL));
  }
  return Boolean(whitelistMerklCampaignIds?.has(id));
}
