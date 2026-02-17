import { API_BASE } from '@/lib/apiBase';
import type { MerklForecastStateResponse, MerklForecastStatesBatchResponse } from '@/types/aave';
import { MerklForecastApiError } from './merklForecastErrors';

const CACHE_TTL_MS = 3 * 60 * 1000;

const cache = new Map<string, { data: MerklForecastStateResponse; expiresAt: number }>();
const inFlight = new Map<string, Promise<MerklForecastStateResponse>>();
const batchCache = new Map<string, { data: MerklForecastStatesBatchResponse; expiresAt: number }>();
const batchInFlight = new Map<string, Promise<MerklForecastStatesBatchResponse>>();

export const fetchMerklForecastState = async (
  campaignId: string,
  options?: { forceRefresh?: boolean }
): Promise<MerklForecastStateResponse> => {
  const id = campaignId.trim();
  if (!id) {
    throw new Error('campaignId is required');
  }

  const now = Date.now();
  const cached = cache.get(id);
  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  const existing = inFlight.get(id);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const response = await fetch(`${API_BASE}/campaigns/${id}/forecast-state`);
      if (!response.ok) {
        throw new MerklForecastApiError(`Failed to fetch Merkl forecast state (${response.status})`, response.status);
      }
      const data = (await response.json()) as MerklForecastStateResponse;
      cache.set(id, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, request);
  return request;
};

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
      const expiresAt = Date.now() + CACHE_TTL_MS;
      batchCache.set(key, { data, expiresAt });
      data.items.forEach((item) => {
        cache.set(item.campaignId, { data: item, expiresAt });
      });

      return data;
    } finally {
      batchInFlight.delete(key);
    }
  })();

  batchInFlight.set(key, request);
  return request;
};
