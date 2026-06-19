import type { ForecastableBreakdown, MerklForecastWireItem } from '@/types/aave';
import {
  parseMerklNumeric,
  calculatePointsApr,
  safePointToUsdRate,
  isMerklPointsCampaign,
  convertMerklPointsAmountToUsd,
} from '@/lib/tydro';
import { computeBudgetRemainingDays } from '@/lib/incentiveMath';
import { convertAprToApy, apyToApr } from '@/lib/rateCalculations';

const DAYS_PER_YEAR = 365;
const SECONDS_PER_DAY = 86400;
const EPSILON = 1e-9;

export interface MerklForecastState {
  campaignType?: string;
  plannedDaily?: number;
  /** Dynamic daily target for remaining time. Only used by non-DUTCH types (MAX/FIX). */
  requiredDaily?: number;
  /** Annual rate as a decimal (e.g. 0.032 for 3.2%/year). Not API percent points. */
  aprCap?: number | null;
  distributedSoFar?: number;
  totalBudget?: number;
  latestTvl?: number;
  endTimestamp?: number;
  /** Native APY in percent points (e.g. 3.0 for 3%). Only used by TARGET_TOTAL_APR. */
  nativeApyPercent?: number;
  /** Budget-bound mode: MAX_APR (dilutive) or FIX_APR (early-end). Only used by TARGET_TOTAL_APR. */
  budgetBoundMode?: string;
}

export type MerklForecastProgressState = MerklForecastState;

export interface MerklForecastResult {
  dailyRewards: number;
  apr: number;
  regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
  fixRewardableDays?: number;
  fixRewardableUntilTs?: number;
}

export interface MerklForecastProgressFlags {
  isUnderDistributed: boolean;
}

const safe = (value: number): number => (Number.isFinite(value) ? Math.max(value, 0) : 0);

/**
 * `aprCap` on Merkl breakdowns from `GET /api/markets` is **percent points** (same unit as `campaignApr`).
 * `forecastWithTVL` expects an annual rate **decimal** (e.g. 0.032 for 3.2%).
 */
export function merklAprCapPercentToForecastDecimal(
  aprCap: number | null | undefined
): number | null | undefined {
  if (aprCap === null || aprCap === undefined) return aprCap;
  if (!Number.isFinite(aprCap)) return undefined;
  return aprCap / 100;
}

export const forecastWithTVL = (
  forecastState: MerklForecastState,
  tvl: number,
  nowTs = Math.floor(Date.now() / 1000)
): MerklForecastResult => {
  const safeTvl = safe(tvl);
  const isMaxAprCampaign = forecastState.campaignType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE';
  const isFixAprCampaign = forecastState.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE';
  const isTargetTotalAprCampaign = forecastState.campaignType === 'TARGET_TOTAL_APR';
  const isRateLimitedCampaign = isMaxAprCampaign || isFixAprCampaign;

  if (safeTvl <= 0) {
    return {
      dailyRewards: 0,
      apr: 0,
      regime: isMaxAprCampaign || (isTargetTotalAprCampaign && forecastState.budgetBoundMode === 'MAX_APR') ? 'APR_CAPPED' : 'PLANNED',
    };
  }

  const plannedDaily = safe(forecastState.plannedDaily ?? 0);

  // DUTCH_AUCTION: no APR cap, no catch-up; dailyRewards = plannedDaily.
  if (forecastState.campaignType === 'DUTCH_AUCTION') {
    const apr = (plannedDaily * DAYS_PER_YEAR) / safeTvl;
    return { dailyRewards: plannedDaily, apr, regime: 'PLANNED' as const };
  }

  // TARGET_TOTAL_APR: aprCap is total APR target, not Merkl payable cap.
  // Compute effectiveAprCap = max(convertAprToApy(aprCap*100) - nativeApy, 0) converted back to APR decimal.
  if (isTargetTotalAprCampaign) {
    const nativeApy = forecastState.nativeApyPercent ?? 0;
    const aprCapDecimal = safe(forecastState.aprCap ?? 0);
    const targetApyPercent = convertAprToApy(aprCapDecimal * 100);
    const effectiveApyPercent = Math.max(targetApyPercent - nativeApy, 0);
    const effectiveAprCap = apyToApr(effectiveApyPercent) / 100;

    const remainingBudget = safe((forecastState.totalBudget ?? 0) - (forecastState.distributedSoFar ?? 0));
    const remainingDays = Math.max((safe(forecastState.endTimestamp) - safe(nowTs)) / SECONDS_PER_DAY, 0);
    const aprBasedDaily = (safeTvl * effectiveAprCap) / DAYS_PER_YEAR;

    if (forecastState.budgetBoundMode === 'FIX_APR') {
      const dailyRewards = aprBasedDaily;
      const apr = effectiveAprCap;
      const fixRewardableDays = computeBudgetRemainingDays(remainingBudget, dailyRewards, remainingDays);
      const fixRewardableUntilTs = Math.floor(
        Math.min(
          safe(forecastState.endTimestamp),
          safe(nowTs) + fixRewardableDays * SECONDS_PER_DAY
        )
      );

      return {
        dailyRewards,
        apr,
        regime: 'PLANNED',
        fixRewardableDays,
        fixRewardableUntilTs,
      };
    }

    // MAX_APR (default for TARGET_TOTAL_APR)
    const requiredDaily = safe(forecastState.requiredDaily ?? plannedDaily);
    const dailyRewards = Math.min(requiredDaily, aprBasedDaily);
    const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
    const capBinding = aprBasedDaily < requiredDaily;
    const isCatchingUp = requiredDaily > plannedDaily * 1.01;

    let regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
    if (capBinding) {
      regime = 'APR_CAPPED';
    } else if (isCatchingUp) {
      regime = 'CATCHING_UP';
    } else {
      regime = 'PLANNED';
    }

    return {
      dailyRewards,
      apr,
      regime,
    };
  }

  const remainingBudget = safe((forecastState.totalBudget ?? 0) - (forecastState.distributedSoFar ?? 0));
  const remainingDays = Math.max((safe(forecastState.endTimestamp) - safe(nowTs)) / SECONDS_PER_DAY, 0);
  const aprCap = safe(forecastState.aprCap ?? 0);
  const aprBasedDaily = (safeTvl * aprCap) / DAYS_PER_YEAR;

  if (isFixAprCampaign) {
    const dailyRewards = Math.min(aprBasedDaily, remainingBudget);
    const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
    const fixRewardableDays = computeBudgetRemainingDays(remainingBudget, aprBasedDaily, remainingDays);
    const fixRewardableUntilTs = Math.floor(
      Math.min(
        safe(forecastState.endTimestamp),
        safe(nowTs) + fixRewardableDays * SECONDS_PER_DAY
      )
    );

    return {
      dailyRewards,
      apr,
      regime: 'PLANNED',
      fixRewardableDays,
      fixRewardableUntilTs,
    };
  }

  // MAX_REWARD path: requiredDaily may diverge from plannedDaily (catch-up).
  const requiredDaily = safe(forecastState.requiredDaily ?? plannedDaily);
  const dailyRewards = Math.min(requiredDaily, aprBasedDaily);
  const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
  const capBinding = aprBasedDaily < requiredDaily;
  const isCatchingUp = requiredDaily > plannedDaily * 1.01;

  let regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
  if (capBinding) {
    regime = 'APR_CAPPED';
  } else if (isCatchingUp) {
    regime = 'CATCHING_UP';
  } else {
    regime = 'PLANNED';
  }

  return {
    dailyRewards,
    apr,
    regime,
  };
};

export const deriveForecastProgressFlags = (
  forecastState: MerklForecastProgressState,
  nowTs = Math.floor(Date.now() / 1000)
): MerklForecastProgressFlags => {
  const distributedSoFar = safe(forecastState.distributedSoFar);
  const totalBudget = safe(forecastState.totalBudget);
  const endTimestamp = safe(forecastState.endTimestamp);

  if (endTimestamp > 0 && nowTs >= endTimestamp) {
    return {
      isUnderDistributed: distributedSoFar < totalBudget,
    };
  }

  return {
    isUnderDistributed: false,
  };
};

export const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

/**
 * Display APR for a Merkl breakdown. `campaignApr` from `GET /api/markets` is already **percent points**
 * (e.g. 5 => 5%/year); do not rescale.
 *
 * Precedence:
 * 1. `campaignApr > 0` → use directly
 * 2. `pointsPerThousandUsd` present and positive → Tydro points formula
 * 3. Return 0 (MAX/FIX capped fallbacks are handled by `forecastWithTVL`, not here)
 */
export const getMerklBreakdownApr = (
  breakdown: ForecastableBreakdown,
  pointToUsdRate: number,
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

  return 0;
};

/**
 * Merge opportunity-only fields from breakdown (1-min) with metrics-only fields from forecast (10-min).
 * Points-based campaigns still follow the actual Merkl campaignType; forecast constraints stay
 * type-driven even when the campaign's display intensity comes from pointsPerThousandUsd.
 */
export const mergeForecastState = (
  breakdown: ForecastableBreakdown,
  forecastStates: Record<string, MerklForecastWireItem>,
  pointToUsdRate: number,
  nativeApyPercent?: number,
): MerklForecastState | null => {
  if (!breakdown.campaignId || !breakdown.campaignType) return null;
  const metrics = forecastStates[String(breakdown.campaignId)];
  const normalizeUsdUnit = (value: number | null | undefined): number | undefined => {
    if (isMerklPointsCampaign(breakdown)) {
      return convertMerklPointsAmountToUsd(value, pointToUsdRate);
    }
    return value ?? undefined;
  };
  return {
    campaignType: breakdown.campaignType,
    totalBudget: normalizeUsdUnit(breakdown.totalBudget),
    aprCap: merklAprCapPercentToForecastDecimal(breakdown.aprCap),
    latestTvl: normalizeUsdUnit(breakdown.latestTvl),
    plannedDaily: normalizeUsdUnit(breakdown.plannedDaily),
    requiredDaily: normalizeUsdUnit(metrics?.requiredDaily),
    distributedSoFar: normalizeUsdUnit(metrics?.distributedSoFar),
    endTimestamp: metrics?.endTimestamp,
    nativeApyPercent,
    budgetBoundMode: breakdown.budgetBoundMode,
  };
};

/**
 * Resolve Merkl breakdown APR with forecast-based fallback.
 *
 * - `inputUsd <= 0` and `currentApr > 0` → return currentApr (normal display)
 * - `inputUsd <= 0` and `currentApr === 0` → forecastWithTVL at current TVL (fallback for MAX/FIX/DUTCH)
 * - `inputUsd > 0`  → forecastWithTVL at hypothetical TVL (scenario forecast)
 *
 * For TARGET_TOTAL_APR with campaignApr=0, returns 0 immediately (nativeAPY ≥ targetAPR → no incentive).
 *
 * Callers are responsible for whitelist filtering before calling this function.
 */
export const forecastMerklApr = (
  breakdown: ForecastableBreakdown,
  inputUsd: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  pointToUsdRate: number,
  nativeApyPercent?: number,
): number => {
  const currentApr = sanitizePercent(getMerklBreakdownApr(breakdown, pointToUsdRate));

  if (currentApr <= 0 && breakdown.campaignType === 'TARGET_TOTAL_APR') {
    return 0;
  }

  const merged = mergeForecastState(breakdown, forecastStates, pointToUsdRate, nativeApyPercent);
  if (!merged) return currentApr;

  if (inputUsd <= 0) {
    if (currentApr > 0) return currentApr;
    return sanitizePercent(forecastWithTVL(merged, Math.max(merged.latestTvl ?? 0, 0)).apr * 100);
  }

  const hypotheticalTvl = Math.max((merged.latestTvl ?? 0) + inputUsd, 0);
  return sanitizePercent(forecastWithTVL(merged, hypotheticalTvl).apr * 100);
};
