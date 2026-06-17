import type { MerklCampaignBreakdown } from '@/types/aave';

// Frontend-configurable rate: 1 Tydro point = 1 USD (default)
export const TYDRO_POINT_TO_USD_RATE = 1;

const hasPointsField = (breakdown: Pick<MerklCampaignBreakdown, 'pointsPerThousandUsd'>): boolean =>
  Object.prototype.hasOwnProperty.call(breakdown, 'pointsPerThousandUsd');

/** Coerce API/cache values that may arrive as numeric strings. */
export function parseMerklNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function safePointToUsdRate(pointToUsdRate: number): number {
  if (!Number.isFinite(pointToUsdRate) || pointToUsdRate < 0) {
    if (import.meta.env.DEV) {
      console.warn('[safePointToUsdRate] invalid pointToUsdRate:', pointToUsdRate, '— falling back to 0');
    }
    return 0;
  }
  return pointToUsdRate;
}

export type PointRateMap = Record<string, number>;

export function getPointToUsdRate(symbol: string | undefined, pointRateMap: PointRateMap, missingSymbolFallback = 0): number {
  if (!symbol) return missingSymbolFallback;
  const key = symbol.toLowerCase();
  if (key in pointRateMap) return pointRateMap[key];
  return 0;
}

export function buildPointRateMap(tydroPointToUsdRate: number): PointRateMap {
  return { tydroinkpoints: safePointToUsdRate(tydroPointToUsdRate) };
}

export const calculatePointsApr = (pointsPerThousandUsd: number, pointToUsdRate = TYDRO_POINT_TO_USD_RATE): number => {
  if (isNaN(pointsPerThousandUsd) || pointsPerThousandUsd <= 0) return 0;
  return pointsPerThousandUsd * pointToUsdRate * 36.5;
};

export { getMerklBreakdownApr } from './merklForecast';

export const getMerklForecastUsdMultiplier = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number => {
  if (!hasPointsField(breakdown)) {
    return 1;
  }
  return safePointToUsdRate(pointToUsdRate) / TYDRO_POINT_TO_USD_RATE;
};

/**
 * Points-mode Merkl campaign:
 * - campaignApr is missing/zero/non-positive
 * - pointsPerThousandUsd is present and positive
 */
export const isMerklPointsCampaign = (
  breakdown: Pick<MerklCampaignBreakdown, 'campaignApr' | 'pointsPerThousandUsd'>
): boolean => {
  const campaignApr = parseMerklNumeric(breakdown.campaignApr);
  const hasPoints = hasPointsField(breakdown);
  if (!hasPoints) return false;
  return (campaignApr ?? 0) <= 0;
};

export const convertMerklPointsAmountToUsd = (
  amount: number | null | undefined,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number | undefined => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return undefined;
  return amount * safePointToUsdRate(pointToUsdRate);
};
