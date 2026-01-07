import { useQuery } from '@tanstack/react-query';
import { MarketsResponse, MarketStats, MarketListItem, SortField, SortOrder } from '@/types/aave';

const API_BASE = 'https://api.aaveapy.com/api';

interface FetchMarketsParams {
  sort?: SortField;
  order?: SortOrder;
  chain?: string;
  token?: string;
}

export const fetchMarkets = async (params?: FetchMarketsParams): Promise<MarketsResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.chain) searchParams.set('chain', params.chain);
  if (params?.token) searchParams.set('token', params.token);

  const response = await fetch(`${API_BASE}/markets?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch markets');
  return response.json();
};

export const fetchMarketStats = async (): Promise<MarketStats> => {
  const response = await fetch(`${API_BASE}/markets/stats`);
  if (!response.ok) throw new Error('Failed to fetch market stats');
  return response.json();
};

export const fetchMarketsList = async (): Promise<MarketListItem[]> => {
  const response = await fetch(`${API_BASE}/markets/list`);
  if (!response.ok) throw new Error('Failed to fetch markets list');
  return response.json();
};

export const useAaveMarkets = (params?: FetchMarketsParams) => {
  return useQuery({
    queryKey: ['aave-markets', params],
    queryFn: () => fetchMarkets(params),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
  });
};

export const useAaveMarketStats = () => {
  return useQuery({
    queryKey: ['aave-market-stats'],
    queryFn: fetchMarketStats,
    staleTime: 60000,
  });
};

export const useAaveMarketsList = () => {
  return useQuery({
    queryKey: ['aave-markets-list'],
    queryFn: fetchMarketsList,
    staleTime: 300000, // 5 minutes
  });
};
