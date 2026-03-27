import { useMemo } from 'react';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import type { MerklForecastWireItem } from '@/types/aave';

export interface MerklForecastStatesResult {
  states: Record<string, MerklForecastWireItem>;
  errors: Record<string, string>;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useMerklForecastStates(campaignIds?: string[]): MerklForecastStatesResult {
  const query = useSideDataMeta(QUERY_STALE_TIMES.merklForecast);

  const { states, errors } = useMemo(() => {
    const forecast = query.data?.forecast;
    if (!forecast) {
      return { states: {}, errors: {} };
    }

    const allStates: Record<string, MerklForecastWireItem> = {};
    const allErrors: Record<string, string> = {};

    forecast.items.forEach((item) => {
      allStates[item.campaignId] = item;
    });

    forecast.errors
      .filter((item) => shouldSurfaceForecastError(item))
      .forEach((item) => {
        allErrors[item.campaignId] = item.message;
      });

    if (!campaignIds || campaignIds.length === 0) {
      return { states: allStates, errors: allErrors };
    }

    const idSet = new Set(campaignIds);
    const filteredStates: Record<string, MerklForecastWireItem> = {};
    const filteredErrors: Record<string, string> = {};

    Object.entries(allStates).forEach(([id, state]) => {
      if (idSet.has(id)) {
        filteredStates[id] = state;
      }
    });

    Object.entries(allErrors).forEach(([id, error]) => {
      if (idSet.has(id)) {
        filteredErrors[id] = error;
      }
    });

    return { states: filteredStates, errors: filteredErrors };
  }, [query.data?.forecast, campaignIds]);

  return {
    states,
    errors,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
  };
}
