import { useQuery } from '@tanstack/react-query';

/** Free, key-less FX endpoint with permissive CORS. */
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

export interface FxSnapshot {
  /** How many units of the target currency one USD buys. */
  rate: number;
  /** ISO date string of the provider's last update. */
  updatedAt?: string;
}

export async function fetchUsdRate(currency: string): Promise<FxSnapshot> {
  const response = await fetch(FX_ENDPOINT);
  if (!response.ok) throw new Error(`FX request failed [${response.status}]`);
  const data = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  const rate = data.rates?.[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`FX rate unavailable for ${currency}`);
  }
  return { rate, updatedAt: data.time_last_update_utc };
}

/**
 * USD -> local currency rate. Yield maths does not need it (a percentage of a
 * converted amount is the same percentage), so consumers must degrade gracefully
 * and simply hide the USD equivalent when this query fails.
 */
export function useUsdRate(currency: string) {
  return useQuery({
    queryKey: ['fx-usd', currency],
    queryFn: () => fetchUsdRate(currency),
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
    enabled: currency !== 'USD',
  });
}
