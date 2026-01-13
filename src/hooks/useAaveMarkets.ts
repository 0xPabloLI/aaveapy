import { useQuery } from '@tanstack/react-query';
import { MarketsResponse, MarketStats, MarketListItem } from '@/types/aave';

// 从环境变量读取API地址，如果没有设置则使用远程地址作为默认值
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.aaveapy.com/api';

// 获取所有市场数据（所有排序和过滤都在前端完成）
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
