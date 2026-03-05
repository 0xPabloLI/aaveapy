import { useQuery } from '@tanstack/react-query';
import { MarketsResponse, MarketListItem } from '@/types/aave';
import {
  getCachedMarkets,
  setCachedMarkets,
  getCachedMarketsList,
  setCachedMarketsList,
} from '@/lib/cache';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';

// Read API base URL from environment variable, fallback to remote URL if not set
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.aaveapy.com/api';

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
  // Use cached data as placeholder for instant display (SWR pattern)
  const cachedData = getCachedMarkets();
  return useQuery({
    queryKey: ['aave-markets'],
    queryFn: fetchMarkets,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    placeholderData: cachedData ?? undefined,
  });
};

export const useAaveMarketsList = () => {
  const cachedData = getCachedMarketsList();
  return useQuery({
    queryKey: ['aave-markets-list'],
    queryFn: fetchMarketsList,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    placeholderData: cachedData ?? undefined,
  });
};
