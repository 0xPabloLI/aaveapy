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
 * Display APR for a Merkl breakdown. Precedence matches the original Tydro integration:
 * when `pointsPerThousandUsd` is present and yields a positive Tydro APR, use that; otherwise
 * fall back to `campaignApr` (with loose numeric coercion). Merkl may send both fields; Ink /
 * Tydro campaigns are driven by the point curve when points are present.
 */
export const getMerklBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number => {
  const points = parseMerklNumeric(breakdown.pointsPerThousandUsd);
  if (points !== undefined && points > 0) {
    const tydroApr = calculateTydroApr(points, safePointToUsdRate(pointToUsdRate));
    if (tydroApr > 0) return tydroApr;
  }
  return parseMerklNumeric(breakdown.campaignApr) ?? 0;
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
