import { useQuery } from '@tanstack/react-query';
import { TokenCategoryOverrides } from '@/lib/tokenCategories';

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
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
};
