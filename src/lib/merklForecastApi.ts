import { API_BASE } from '@/lib/apiBase';
import type { MerklForecastStateResponse, MerklForecastStatesBatchResponse } from '@/types/aave';
import { MerklForecastApiError } from './merklForecastErrors';

const CACHE_TTL_MS = 3 * 60 * 1000;

const cache = new Map<string, { data: MerklForecastStateResponse; expiresAt: number }>();
const inFlight = new Map<string, Promise<MerklForecastStateResponse>>();

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
  const url =
    deduped.length > 0
      ? `${API_BASE}/campaigns/forecast-states?ids=${encodeURIComponent(deduped.join(','))}`
      : `${API_BASE}/campaigns/forecast-states`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new MerklForecastApiError(`Failed to fetch Merkl forecast states (${response.status})`, response.status);
  }

  const data = (await response.json()) as MerklForecastStatesBatchResponse;
  data.items.forEach((item) => {
    cache.set(item.campaignId, { data: item, expiresAt: Date.now() + CACHE_TTL_MS });
  });

  return data;
};
