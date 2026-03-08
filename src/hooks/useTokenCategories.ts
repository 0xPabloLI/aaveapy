import { useQuery } from '@tanstack/react-query';
import { TokenCategoryOverrides } from '@/lib/tokenCategories';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedTokenCategoriesEntry, setCachedTokenCategories } from '@/lib/cache';
import { API_BASE } from '@/lib/apiBase';
import { CoingeckoCategoriesResponseSchema } from '@/lib/apiSchemas';

interface CoingeckoCategoriesResponse {
  uniqueSymbolsStablecoins?: string[];
  uniqueSymbolsEth?: string[];
}

const fetchTokenCategories = async (): Promise<TokenCategoryOverrides> => {
  const response = await fetch(`${API_BASE}/coingecko-categories`);
  if (!response.ok) {
    throw new Error('Failed to fetch token categories');
  }
  const raw = await response.json();
  const data = CoingeckoCategoriesResponseSchema.parse(raw) as CoingeckoCategoriesResponse;
  const normalized: TokenCategoryOverrides = {
    stablecoins: data.uniqueSymbolsStablecoins ?? [],
    ethRelated: data.uniqueSymbolsEth ?? [],
  };
  setCachedTokenCategories(normalized);
  return normalized;
};

export const useTokenCategories = () => {
  const cachedEntry = getCachedTokenCategoriesEntry<TokenCategoryOverrides>();
  return useQuery({
    queryKey: ['token-categories'],
    queryFn: fetchTokenCategories,
    staleTime: QUERY_STALE_TIMES.tokenCategories,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
    retry: 1,
  });
};
