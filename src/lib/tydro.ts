import type { MerklCampaignBreakdown } from '@/types/aave';

// Frontend-configurable rate: 1 Tydro point = 1 USD (default)
export const TYDRO_POINT_TO_USD_RATE = 1;

const hasPointsField = (breakdown: Pick<MerklCampaignBreakdown, 'pointsPerThousandUsd'>): boolean =>
  Object.prototype.hasOwnProperty.call(breakdown, 'pointsPerThousandUsd');

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

const calculatePointsApr = (pointsPerThousandUsd: number, pointToUsdRate = TYDRO_POINT_TO_USD_RATE): number => {
  if (isNaN(pointsPerThousandUsd) || pointsPerThousandUsd <= 0) return 0;
  return pointsPerThousandUsd * pointToUsdRate * 36.5;
};

const calculateDutchAuctionFallbackApr = (
  plannedDaily: number | undefined,
  latestTvl: number | undefined,
  pointToUsdRate: number
): number | undefined => {
  if (!Number.isFinite(plannedDaily) || !Number.isFinite(latestTvl) || (latestTvl ?? 0) <= 0) return undefined;

  const plannedDailyUsd = convertMerklPointsAmountToUsd(plannedDaily, safePointToUsdRate(pointToUsdRate));
  if (plannedDailyUsd === undefined) return undefined;

  const impliedApr = (plannedDailyUsd * 365 * 100) / latestTvl;
  return Number.isFinite(impliedApr) && impliedApr >= 0 ? impliedApr : undefined;
};

/**
 * Display APR for a Merkl breakdown. `campaignApr` from `GET /api/markets` is already **percent points**
 * (e.g. 5 => 5%/year); do not rescale.
 *
 * Precedence:
 * 1. `campaignApr > 0` → use directly
 * 2. `pointsPerThousandUsd` present and positive → Tydro points formula
 * 3. `DUTCH_AUCTION` → implied APR from `plannedDaily / latestTvl`
 *    (points-to-USD conversion applied only when points field is present)
 * 4. Return 0 (MAX/FIX capped fallbacks are handled by `forecastWithTVL`, not here)
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
    const tydroApr = calculatePointsApr(points, safePointToUsdRate(pointToUsdRate));
    if (tydroApr > 0) return tydroApr;
  }

  if (breakdown.campaignType === 'DUTCH_AUCTION') {
    // For points campaigns plannedDaily is in points; convert to USD.
    // For non-points campaigns plannedDaily is already USD; use neutral rate (1).
    const effectiveRate = hasPointsField(breakdown) ? pointToUsdRate : TYDRO_POINT_TO_USD_RATE;
    const fallbackApr = calculateDutchAuctionFallbackApr(
      parseMerklNumeric(breakdown.plannedDaily),
      parseMerklNumeric(breakdown.latestTvl),
      effectiveRate
    );
    if (fallbackApr !== undefined) {
      return fallbackApr;
    }
  }

  return 0;
};

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
