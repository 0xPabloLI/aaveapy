import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import {
  getCachedRateInputsSnapshotEntry,
  setCachedRateInputsSnapshot,
} from '@/lib/cache';
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

export class RateInputsUnavailableError extends Error {
  constructor(status: number, statusText: string) {
    super(`Native simulation unavailable (${status})`);
    this.name = 'RateInputsUnavailableError';
  }
}

export async function fetchRateInputsSnapshot(): Promise<RateInputsResponse> {
  const response = await fetch(`${API_BASE}/rate-inputs`);
  if (!response.ok) {
    throw new RateInputsUnavailableError(response.status, response.statusText);
  }
  const payload = (await response.json()) as RateInputsResponse;
  setCachedRateInputsSnapshot(payload);
  return payload;
}

export async function prefetchRateInputsSnapshot(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
  });
}

export function findReserveRateInput(
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
  const cachedEntry = getCachedRateInputsSnapshotEntry<RateInputsResponse>();

  const snapshotQuery = useQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    enabled: enabled && chainId > 0 && normalizedTokenAddress.length > 0 && normalizedMarketName.length > 0,
    staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
    retry: (failureCount, error) => {
      if (error instanceof RateInputsUnavailableError) return false;
      return failureCount < 2;
    },
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
