import { useQuery } from '@tanstack/react-query';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedCoingeckoFdvEntry, setCachedCoingeckoFdv } from '@/lib/cache';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.aaveapy.com/api';

interface CoingeckoFdvItem {
  id: string;
  symbol: string | null;
  name: string | null;
  fdvUsd: number | null;
}

interface CoingeckoFdvResponse {
  items: CoingeckoFdvItem[];
  fetchedAt: string;
}

const fetchCoingeckoFdv = async (): Promise<CoingeckoFdvResponse> => {
  const response = await fetch(`${API_BASE}/coingecko-fdv`);
  if (!response.ok) {
    throw new Error('Failed to fetch CoinGecko FDV data');
  }
  const data = (await response.json()) as CoingeckoFdvResponse;
  setCachedCoingeckoFdv(data);
  return data;
};

export const useCoingeckoFdv = () => {
  const cachedEntry = getCachedCoingeckoFdvEntry<CoingeckoFdvResponse>();
  return useQuery({
    queryKey: ['coingecko-fdv'],
    queryFn: fetchCoingeckoFdv,
    staleTime: QUERY_STALE_TIMES.coingeckoFdv,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
    retry: 1,
  });
};
