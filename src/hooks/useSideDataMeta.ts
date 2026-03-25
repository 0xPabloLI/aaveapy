import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/apiBase';
import { SideDataMetaResponseSchema } from '@/lib/apiSchemas';
import {
  getCachedSideDataMetaEntry,
  setCachedCoingeckoFdv,
  setCachedMerklForecastStates,
  setCachedSideDataMeta,
  setCachedTokenCategories,
} from '@/lib/cache';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import type { MerklForecastStateResponse } from '@/types/aave';

export const SIDE_DATA_META_QUERY_KEY = ['side-data-meta'] as const;

export interface SideDataForecastItem {
  campaignId: string;
  requiredDaily?: number;
  distributedSoFar?: number;
  endTimestamp?: number;
}

export interface SideDataForecastError {
  campaignId: string;
  message: string;
}

export interface SideDataMetaResponse {
  generatedAt?: string;
  partial?: boolean;
  categories?: {
    uniqueSymbolsStablecoins: string[];
    uniqueSymbolsEth: string[];
    fetchedAt: string;
    staleTimeMs: number;
  };
  fdv?: {
    items: Array<{
      id: string;
      symbol: string | null;
      name: string | null;
      fdvUsd: number | null;
      source?: string;
    }>;
    fetchedAt: string;
    staleTimeMs: number;
  };
  forecast?: {
    items: SideDataForecastItem[];
    errors: SideDataForecastError[];
    staleTimeMs: number;
  };
  errors?: Record<string, string>;
}

export async function fetchSideDataMeta(): Promise<SideDataMetaResponse> {
  const response = await fetch(`${API_BASE}/meta/side-data`);
  if (!response.ok) {
    throw new Error(`Failed to fetch side-data meta (${response.status})`);
  }

  const raw = await response.json();
  const parsed = SideDataMetaResponseSchema.parse(raw) as SideDataMetaResponse;

  // Cache full payload so we can derive staleTime from backend TTLs.
  setCachedSideDataMeta(parsed);

  if (parsed.fdv) {
    setCachedCoingeckoFdv({
      items: parsed.fdv.items,
      fetchedAt: parsed.fdv.fetchedAt,
    });
  }

  if (parsed.categories) {
    setCachedTokenCategories({
      stablecoins: parsed.categories.uniqueSymbolsStablecoins,
      ethRelated: parsed.categories.uniqueSymbolsEth,
    });
  }

  if (parsed.forecast) {
    const states: Record<string, MerklForecastStateResponse> = {};
    const errors: Record<string, string> = {};
    parsed.forecast.items.forEach((item) => {
      states[item.campaignId] = item;
    });
    parsed.forecast.errors
      .filter((item) => shouldSurfaceForecastError(item))
      .forEach((item) => {
        errors[item.campaignId] = item.message;
      });
    setCachedMerklForecastStates({ states, errors });
  }

  return parsed;
}

export function useSideDataMeta(staleTime: number, retry: number = 1) {
  const cachedEntry = getCachedSideDataMetaEntry<SideDataMetaResponse>();

  const derivedStaleTime = (() => {
    const payload = cachedEntry?.data;
    if (!payload) return staleTime;

    const candidates: number[] = [];
    if (payload.categories?.staleTimeMs != null) {
      candidates.push(payload.categories.staleTimeMs);
    }
    if (payload.fdv?.staleTimeMs != null) {
      candidates.push(payload.fdv.staleTimeMs);
    }
    if (payload.forecast?.staleTimeMs != null) {
      candidates.push(payload.forecast.staleTimeMs);
    }
    return candidates.length > 0 ? Math.min(...candidates) : staleTime;
  })();

  return useQuery({
    queryKey: SIDE_DATA_META_QUERY_KEY,
    queryFn: fetchSideDataMeta,
    staleTime: derivedStaleTime,
    retry,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });
}

