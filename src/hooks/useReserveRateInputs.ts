import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import type { RateInputsResponse, ReserveRateInput } from '@/types/aave';

interface UseReserveRateInputParams {
  chainId: number;
  tokenAddress: string;
  marketName: string;
  enabled?: boolean;
}

export const RATE_INPUTS_SNAPSHOT_QUERY_KEY = ['rate-inputs-snapshot'] as const;

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMarketName(value: string): string {
  return value.trim().toLowerCase();
}

export async function fetchRateInputsSnapshot(): Promise<RateInputsResponse> {
  const response = await fetch(`${API_BASE}/rate-inputs`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rate inputs snapshot: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as RateInputsResponse;
}

export async function prefetchRateInputsSnapshot(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
  });
}

function findReserveRateInput(
  payload: RateInputsResponse,
  chainId: number,
  tokenAddress: string,
  marketName: string
): ReserveRateInput | null {
  const normalizedTokenAddress = normalizeAddress(tokenAddress);
  const normalizedMarketName = normalizeMarketName(marketName);
  return (
    payload.data.find(
      (entry) =>
        entry.chainId === chainId &&
        normalizeAddress(entry.tokenAddress) === normalizedTokenAddress &&
        normalizeMarketName(entry.marketName) === normalizedMarketName
    ) ?? null
  );
}

export function useReserveRateInput({
  chainId,
  tokenAddress,
  marketName,
  enabled = true,
}: UseReserveRateInputParams) {
  const normalizedTokenAddress = normalizeAddress(tokenAddress);
  const normalizedMarketName = normalizeMarketName(marketName);
  const snapshotQuery = useQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    enabled: enabled && chainId > 0 && normalizedTokenAddress.length > 0 && normalizedMarketName.length > 0,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
  });

  const selected = useMemo(() => {
    if (!snapshotQuery.data) return null;
    return findReserveRateInput(snapshotQuery.data, chainId, normalizedTokenAddress, normalizedMarketName);
  }, [snapshotQuery.data, chainId, normalizedTokenAddress, normalizedMarketName]);

  return {
    ...snapshotQuery,
    data: selected,
  };
}
