import { useQuery } from '@tanstack/react-query';
import { MarketsResponse, MarketListItem } from '@/types/aave';
import {
  getCachedMarkets,
  setCachedMarkets,
  getCachedMarketsList,
  setCachedMarketsList,
  getCachedMarketsEntry,
  getCachedMarketsListEntry,
} from '@/lib/cache';
import { API_BASE } from '@/lib/apiBase';

// Fetch all market data (all sorting and filtering done on frontend)
export const fetchMarkets = async (): Promise<MarketsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/markets`);
    if (!response.ok) throw new Error('Failed to fetch markets');
    const data = await response.json();
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

export const fetchMarketsList = async (): Promise<MarketListItem[]> => {
  try {
    const response = await fetch(`${API_BASE}/markets/list`);
    if (!response.ok) throw new Error('Failed to fetch markets list');
    const data = await response.json();
    // Save to cache on success
    setCachedMarketsList(data);
    return data;
  } catch (error) {
    // Try to get from cache on failure
    const cached = getCachedMarketsList();
    if (cached) {
      console.warn('Using cached markets list due to fetch error:', error);
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

export const useAaveMarketsList = () => {
  const cachedEntry = getCachedMarketsListEntry();
  return useQuery({
    queryKey: ['aave-markets-list'],
    queryFn: fetchMarketsList,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });
};
