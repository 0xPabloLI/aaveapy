import { useQuery } from '@tanstack/react-query';
import { MarketsResponse } from '@/types/aave';
import {
  getCachedMarkets,
  setCachedMarkets,
  getCachedMarketsEntry,
} from '@/lib/cache';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';

// Fetch all market data (breaking change: API returns { snapshot, reserves })
export const fetchMarkets = async (): Promise<MarketsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/markets`);
    if (!response.ok) throw new Error('Failed to fetch markets');
    const raw = await response.json();
    if (!raw?.snapshot?.lastUpdated || !Array.isArray(raw?.reserves)) {
      throw new Error('Invalid markets response: expected { snapshot: { lastUpdated }, reserves }');
    }
    const data = raw as MarketsResponse;
    // Save to cache on success
    setCachedMarkets(data);
    return data;
  } catch (error) {
    // Try to get from cache on failure
    const cached = getCachedMarkets();
    if (cached) {
      console.warn('Using cached markets data due to fetch error:', error);
      return cached;
    }
    // Re-throw if no cache available
    throw error;
  }
};

export const useAaveMarkets = () => {
  const cachedEntry = getCachedMarketsEntry();
  return useQuery({
    queryKey: ['aave-markets'],
    queryFn: fetchMarkets,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });
};
