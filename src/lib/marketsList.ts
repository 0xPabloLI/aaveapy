import type { MarketListItem, MarketsResponse } from '@/types/aave';

export function buildMarketsList(marketsResponse?: MarketsResponse | null): MarketListItem[] {
  if (!marketsResponse?.data) return [];

  const uniqueMarkets = new Map<string, MarketListItem>();

  for (const reserve of marketsResponse.data) {
    if (!reserve.marketName?.trim() || !reserve.chainName?.trim()) continue;

    const key = `${reserve.marketName}::${reserve.chainName}`;
    if (!uniqueMarkets.has(key)) {
      uniqueMarkets.set(key, {
        marketName: reserve.marketName,
        chainName: reserve.chainName,
      });
    }
  }

  const markets = Array.from(uniqueMarkets.values());
  const ethereumMarkets = markets.filter((market) => market.chainName === 'Ethereum');
  const otherMarkets = markets.filter((market) => market.chainName !== 'Ethereum');
  return [...ethereumMarkets, ...otherMarkets];
}
