import type { MerklCampaignBreakdown } from '@/types/aave';

// Frontend-configurable rate: 1 Tydro point = 1 USD (default)
export const TYDRO_POINT_TO_USD_RATE = 1;

export const calculateTydroApr = (pointsPerThousandUsd: number, pointToUsdRate = TYDRO_POINT_TO_USD_RATE): number => {
  if (isNaN(pointsPerThousandUsd) || pointsPerThousandUsd <= 0) return 0;
  return pointsPerThousandUsd * pointToUsdRate * 36.5;
};

export const getMerklBreakdownApr = (
  breakdown: MerklCampaignBreakdown,
  pointToUsdRate = TYDRO_POINT_TO_USD_RATE
): number => {
  if (breakdown.pointsPerThousandUsd !== undefined && !isNaN(breakdown.pointsPerThousandUsd)) {
    const tydroApr = calculateTydroApr(breakdown.pointsPerThousandUsd, pointToUsdRate);
    if (tydroApr > 0) return tydroApr;
  }
  return breakdown.campaignApr;
};
