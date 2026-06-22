import type { MerklCampaignBreakdown } from '@/types/aave';

export const TYDRO_POINT_TO_USD_RATE = 1;

function parseMerklNumeric(value: unknown): number | undefined {
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

export const getPointToUsdRate = (
  rewardTokenSymbol: string | undefined,
  pointRateMap: Record<string, number>,
): number => {
  if (!rewardTokenSymbol) return 0;
  const key = rewardTokenSymbol.toLowerCase();
  if (key in pointRateMap) return pointRateMap[key];
  return 0;
};

const calculateTydroApr = (pointsPerThousandUsd: number, pointToUsdRate: number): number => {
  if (isNaN(pointsPerThousandUsd) || pointsPerThousandUsd <= 0) return 0;
  return pointsPerThousandUsd * safePointToUsdRate(pointToUsdRate) * 36.5;
};

export const getMerklBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = 0
): number => {
  const campaignApr = parseMerklNumeric(breakdown.campaignApr);
  if (campaignApr !== undefined && campaignApr > 0) {
    return campaignApr;
  }
  const points = parseMerklNumeric(breakdown.pointsPerThousandUsd);
  if (points !== undefined && points > 0) {
    const tydroApr = calculateTydroApr(points, pointToUsdRate);
    if (tydroApr > 0) return tydroApr;
  }
  return campaignApr ?? 0;
};

export const getMerklForecastUsdMultiplier = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = 0
): number => {
  if (breakdown.pointsPerThousandUsd === undefined || isNaN(breakdown.pointsPerThousandUsd)) {
    return 1;
  }
  return safePointToUsdRate(pointToUsdRate) / TYDRO_POINT_TO_USD_RATE;
};

export const isMerklPointsCampaign = (
  breakdown: Pick<MerklCampaignBreakdown, 'campaignApr' | 'pointsPerThousandUsd'>
): boolean => {
  const campaignApr = parseMerklNumeric(breakdown.campaignApr);
  const points = parseMerklNumeric(breakdown.pointsPerThousandUsd);
  return (campaignApr ?? 0) <= 0 && (points ?? 0) > 0;
};

export const convertMerklPointsAmountToUsd = (
  amount: number | null | undefined,
  pointToUsdRate = 0
): number | undefined => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return undefined;
  return amount * safePointToUsdRate(pointToUsdRate);
};
