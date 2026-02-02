import { useQuery } from '@tanstack/react-query';

const COINGECKO_SEARCH_BASE = 'https://api.coingecko.com/api/v3/search';

interface CoingeckoCoinSearchItem {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  large: string;
}

interface CoingeckoSearchResponse {
  coins: CoingeckoCoinSearchItem[];
}

async function fetchCoingeckoTokenImage(symbol: string): Promise<string | null> {
  const query = symbol.trim().toLowerCase();
  if (!query) return null;
  const response = await fetch(
    `${COINGECKO_SEARCH_BASE}?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) return null;
  const data = (await response.json()) as CoingeckoSearchResponse;
  const coins = data?.coins;
  if (!Array.isArray(coins) || coins.length === 0) return null;
  const normalizedQuery = query.replace(/\s+/g, '');
  const match =
    coins.find((c) => c.symbol?.toLowerCase().replace(/\s+/g, '') === normalizedQuery) ??
    coins[0];
  return match?.large ?? match?.thumb ?? null;
}

/**
 * Fetches token image URL from CoinGecko search API by symbol.
 * Only runs when symbol is non-null (e.g. when local icon 404 and no logoURI).
 * Cached 24h to respect free tier rate limits.
 *
 * After staleTime (24h) expires, the next use of this query will refetch.
 * To avoid refetches: run `npm run sync-token-icons` and commit new icons
 * so the app serves them from public/icons/tokens/ (no CoinGecko call).
 */
export function useCoingeckoTokenImage(symbol: string | null) {
  const normalizedSymbol = symbol?.trim() ?? null;
  return useQuery({
    queryKey: ['coingecko-token-image', normalizedSymbol],
    queryFn: () => fetchCoingeckoTokenImage(normalizedSymbol!),
    enabled: Boolean(normalizedSymbol),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
