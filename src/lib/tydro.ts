import type { MerklCampaignBreakdown } from '@/types/aave';

// Frontend-configurable rate: 1 Tydro point = 1 USD (default)
export const TYDRO_POINT_TO_USD_RATE = 1;

/** Coerce API/cache values that may arrive as numeric strings. */
function parseMerklNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function safePointToUsdRate(pointToUsdRate: number): number {
  return Number.isFinite(pointToUsdRate) && pointToUsdRate > 0 ? pointToUsdRate : TYDRO_POINT_TO_USD_RATE;
}

const calculateTydroApr = (pointsPerThousandUsd: number, pointToUsdRate = TYDRO_POINT_TO_USD_RATE): number => {
  if (isNaN(pointsPerThousandUsd) || pointsPerThousandUsd <= 0) return 0;
  return pointsPerThousandUsd * pointToUsdRate * 36.5;
};

/**
 * Display APR for a Merkl breakdown. When Merkl provides a positive `campaignApr`, use it first;
 * otherwise derive APR from `pointsPerThousandUsd` (Tydro-style points curve). Merkl may send both.
 */
export const getMerklBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number => {
  const campaignApr = parseMerklNumeric(breakdown.campaignApr);
  if (campaignApr !== undefined && campaignApr > 0) {
    return campaignApr;
  }
  const points = parseMerklNumeric(breakdown.pointsPerThousandUsd);
  if (points !== undefined && points > 0) {
    const tydroApr = calculateTydroApr(points, safePointToUsdRate(pointToUsdRate));
    if (tydroApr > 0) return tydroApr;
  }
  return campaignApr ?? 0;
};

export const getMerklForecastUsdMultiplier = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number => {
  if (breakdown.pointsPerThousandUsd === undefined || isNaN(breakdown.pointsPerThousandUsd)) {
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
  const points = parseMerklNumeric(breakdown.pointsPerThousandUsd);
  return (campaignApr ?? 0) <= 0 && (points ?? 0) > 0;
};

export const convertMerklPointsAmountToUsd = (
  amount: number | null | undefined,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number | undefined => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return undefined;
  return amount * safePointToUsdRate(pointToUsdRate);
};
