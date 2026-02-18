import { API_BASE } from '@/lib/apiBase';
import type { MerklForecastStatesBatchResponse } from '@/types/aave';
import { MerklForecastApiError } from './merklForecastErrors';

const CACHE_TTL_MS = 1 * 60 * 1000;

const batchCache = new Map<string, { data: MerklForecastStatesBatchResponse; expiresAt: number }>();
const batchInFlight = new Map<string, Promise<MerklForecastStatesBatchResponse>>();

export const fetchMerklForecastStates = async (
  campaignIds?: string[]
): Promise<MerklForecastStatesBatchResponse> => {
  const deduped = Array.from(new Set((campaignIds ?? []).map((id) => id.trim()).filter(Boolean)));
  const sortedForKey = [...deduped].sort();
  const key = sortedForKey.length > 0 ? sortedForKey.join(',') : '__all__';
  const now = Date.now();
  const cachedBatch = batchCache.get(key);
  if (cachedBatch && cachedBatch.expiresAt > now) {
    return cachedBatch.data;
  }

  const existing = batchInFlight.get(key);
  if (existing) {
    return existing;
  }

  const url =
    deduped.length > 0
      ? `${API_BASE}/campaigns/forecast-states?ids=${encodeURIComponent(deduped.join(','))}`
      : `${API_BASE}/campaigns/forecast-states`;
  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new MerklForecastApiError(`Failed to fetch Merkl forecast states (${response.status})`, response.status);
      }

      const data = (await response.json()) as MerklForecastStatesBatchResponse;
      batchCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

      return data;
    } finally {
      batchInFlight.delete(key);
    }
  })();

  batchInFlight.set(key, request);
  return request;
};
