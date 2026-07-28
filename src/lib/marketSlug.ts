import { getSubMarketLabel } from '@/lib/marketLabels';
import { marketKey } from '@/lib/marketKey';
import type { MarketListItem } from '@/types/aave';

/**
 * Convert a marketName to a URL-friendly slug.
 *
 * Uses `getSubMarketLabel` to get the human-readable display name,
 * then slugifies it (lowercase + spaces to hyphens).
 *
 * @example
 * slugifyMarketLabel('AaveV3Ethereum')       → 'core'
 * slugifyMarketLabel('AaveV3EthereumHorizon') → 'horizon-rwa'
 * slugifyMarketLabel('AaveV4EthereumLido')   → 'ethereum-lido'
 */
export function slugifyMarketLabel(marketName: string): string {
  return getSubMarketLabel(marketName)
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Resolve an array of market slugs back to `marketKey` values within a
 * specific chain.
 *
 * Only markets whose `chainId` matches are considered for resolution.
 * Slugs that don't match any market in the chain are collected as `invalid`.
 * If two markets on the same chain produce the same slug, a `console.warn` is
 * emitted and the last market wins (Map semantics).
 *
 * Note: callers should pre-trim and filter empty strings from `slugs` (see
 * Index.tsx hydration: `marketParam.split(',').map(s => s.trim()).filter(Boolean)`).
 *
 * @returns `{ resolved, invalid }` — resolved marketKeys and unmatched slugs.
 */
export function resolveMarketSlugs(
  slugs: string[],
  chainId: number,
  marketsList: MarketListItem[],
): { resolved: string[]; invalid: string[] } {
  const chainMarkets = marketsList.filter((m) => m.chainId === chainId);
  const slugToKey = new Map<string, string>();
  for (const m of chainMarkets) {
    const slug = slugifyMarketLabel(m.marketName);
    if (slugToKey.has(slug)) {
      console.warn(
        `[marketSlug] Collision: slug "${slug}" maps to both "${slugToKey.get(slug)}" and "${marketKey(m.chainId, m.marketName)}" on chainId=${chainId}. ` +
        `The last market will win in URL resolution.`,
      );
    }
    slugToKey.set(slug, marketKey(m.chainId, m.marketName));
  }

  const resolved: string[] = [];
  const invalid: string[] = [];
  for (const slug of slugs) {
    const key = slugToKey.get(slug);
    if (key !== undefined) {
      resolved.push(key);
    } else {
      invalid.push(slug);
    }
  }
  return { resolved, invalid };
}
