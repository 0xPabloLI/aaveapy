import type { MarketListItem, MarketsResponse } from '@/types/aave';

/**
 * Fallback chain count for static/SEO pages without live API data.
 * Update when the backend adds/removes chains. Dynamic pages use getChainCount() instead.
 */
export const DEFAULT_CHAIN_COUNT = 21;

export function getChainCount(marketsResponse?: MarketsResponse | null): number {
  const reserves = marketsResponse?.reserves;
  if (!reserves?.length) return 0;
  const uniqueChains = new Set<string>();
  for (const reserve of reserves) {
    if (reserve.chainName?.trim()) uniqueChains.add(reserve.chainName.trim());
  }
  return uniqueChains.size;
}

export function buildMarketsList(marketsResponse?: MarketsResponse | null): MarketListItem[] {
  const reserves = marketsResponse?.reserves;
  if (!reserves?.length) return [];

  const uniqueMarkets = new Map<string, MarketListItem>();

  for (const reserve of reserves) {
    if (!reserve.marketName?.trim() || !reserve.chainName?.trim()) continue;

    const key = `${reserve.marketName}::${reserve.chainName}`;
    if (!uniqueMarkets.has(key)) {
      uniqueMarkets.set(key, {
        marketName: reserve.marketName,
        chainName: reserve.chainName,
        chainId: reserve.chainId,
      });
    }
  }

  const markets = Array.from(uniqueMarkets.values());
  markets.sort((a, b) => {
    const byName = a.marketName.localeCompare(b.marketName, undefined, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.chainName.localeCompare(b.chainName, undefined, { sensitivity: 'base' });
  });
  return markets;
}
