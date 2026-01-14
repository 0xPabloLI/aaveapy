import { useQuery } from '@tanstack/react-query';
import { MarketsResponse, MarketStats, MarketListItem } from '@/types/aave';

// Read API base URL from environment variable, fallback to remote URL if not set
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.aaveapy.com/api';

// Fetch all market data (all sorting and filtering done on frontend)
export const fetchMarkets = async (): Promise<MarketsResponse> => {
  const response = await fetch(`${API_BASE}/markets`);
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

export const useAaveMarkets = () => {
  return useQuery({
    queryKey: ['aave-markets'],
    queryFn: fetchMarkets,
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
