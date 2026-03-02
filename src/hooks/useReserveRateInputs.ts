import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import type { RateInputsResponse, ReserveRateInput } from '@/types/aave';

interface UseReserveRateInputParams {
  chainId: number;
  tokenAddress: string;
  enabled?: boolean;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

async function fetchReserveRateInput(chainId: number, tokenAddress: string): Promise<ReserveRateInput | null> {
  const params = new URLSearchParams();
  params.set('chainId', String(chainId));
  params.set('asset', normalizeAddress(tokenAddress));

  const response = await fetch(`${API_BASE}/rate-inputs?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rate inputs: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as RateInputsResponse;
  const target = normalizeAddress(tokenAddress);
  const item =
    payload.data.find(
      (entry) => entry.chainId === chainId && normalizeAddress(entry.tokenAddress) === target
    ) ?? null;
  return item;
}

export function useReserveRateInput({ chainId, tokenAddress, enabled = true }: UseReserveRateInputParams) {
  const normalized = normalizeAddress(tokenAddress);
  return useQuery({
    queryKey: ['reserve-rate-input', chainId, normalized],
    queryFn: () => fetchReserveRateInput(chainId, normalized),
    enabled: enabled && chainId > 0 && normalized.length > 0,
    staleTime: QUERY_STALE_TIMES.marketApi,
  });
}

