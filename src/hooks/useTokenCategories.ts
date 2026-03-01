import { useQuery } from '@tanstack/react-query';
import { TokenCategoryOverrides } from '@/lib/tokenCategories';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.aaveapy.com/api';

interface CoingeckoCategoriesResponse {
  uniqueSymbolsStablecoins?: string[];
  uniqueSymbolsEth?: string[];
}

const fetchTokenCategories = async (): Promise<TokenCategoryOverrides> => {
  const response = await fetch(`${API_BASE}/coingecko-categories`);
  if (!response.ok) {
    throw new Error('Failed to fetch token categories');
  }
  const data = (await response.json()) as CoingeckoCategoriesResponse;
  return {
    stablecoins: data.uniqueSymbolsStablecoins ?? [],
    ethRelated: data.uniqueSymbolsEth ?? [],
  };
};

export const useTokenCategories = () => {
  return useQuery({
    queryKey: ['token-categories'],
    queryFn: fetchTokenCategories,
    staleTime: QUERY_STALE_TIMES.tokenCategories,
    retry: 1,
  });
};
