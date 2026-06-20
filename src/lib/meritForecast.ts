import type { IncentiveMessage, MeritCampaignGroup } from '@/types/aave';
import { applyPositionCap } from '@/lib/incentiveMath';
import { parseCampaignBoundaryMs } from '@/lib/campaignGroups';

export type MeritMessage = IncentiveMessage;
export type MeritForecastEstimateKind = 'TVL_DILUTION' | 'CURRENT_RATE';

export type MeritEstimateSource = 'reserve_tvl' | 'last_round';

export interface MeritForecastPreview {
  unavailable: false;
  hypotheticalTvl?: number;
  dailyRewards: number;
  apr: number;
  regime: 'PLANNED';
  isUnderDistributed: false;
  estimateKind: MeritForecastEstimateKind;
  meritEstimateSource?: MeritEstimateSource;
  anchorTvlUsd?: number;
  lastRoundRewardUsd?: number;
  usesCurrentRateFallback?: boolean;
}

interface ForecastMeritCampaignInput {
  depositUsd: number;
  forecastAprPercent?: number;
  startDate?: string;
  endDate?: string;
  lastRoundRewardUsd?: number;
  anchorTvlUsd?: number;
}

function sanitizePercent(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? value! : 0;
}

export function getMeritCampaignCycleDays(startDate: string | undefined, endDate: string | undefined): number | null {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  const days = (endMs - startMs) / 1000 / 86400;
  return Number.isFinite(days) && days > 0 ? days : null;
}

function computeMeritBaseEstimate({
  baseAprPercent,
  lastRoundRewardUsd,
  startDate,
  endDate,
}: {
  baseAprPercent: number;
  lastRoundRewardUsd: number;
  startDate?: string;
  endDate?: string;
}) {
  const cycleDays = getMeritCampaignCycleDays(startDate, endDate);
  if (!cycleDays || cycleDays <= 0) return null;
  if (!Number.isFinite(baseAprPercent) || baseAprPercent <= 0) return null;
  if (!Number.isFinite(lastRoundRewardUsd) || lastRoundRewardUsd <= 0) return null;

  const estimatedDailyRewardUsd = lastRoundRewardUsd / cycleDays;
  if (!Number.isFinite(estimatedDailyRewardUsd) || estimatedDailyRewardUsd <= 0) return null;

  const estimatedImpliedTvlUsd = (estimatedDailyRewardUsd * 365 * 100) / baseAprPercent;
  if (!Number.isFinite(estimatedImpliedTvlUsd) || estimatedImpliedTvlUsd <= 0) return null;

  return {
    estimatedDailyRewardUsd,
    estimatedImpliedTvlUsd,
  };
}

function computeMeritBaseFromAnchorTvl({
  baseAprPercent,
  anchorTvlUsd,
}: {
  baseAprPercent: number;
  anchorTvlUsd: number;
}): { estimatedDailyRewardUsd: number; estimatedImpliedTvlUsd: number } | null {
  if (!Number.isFinite(anchorTvlUsd) || anchorTvlUsd <= 0) return null;
  if (!Number.isFinite(baseAprPercent) || baseAprPercent <= 0) return null;
  const estimatedDailyRewardUsd = (anchorTvlUsd * (baseAprPercent / 100)) / 365;
  return {
    estimatedDailyRewardUsd,
    estimatedImpliedTvlUsd: anchorTvlUsd,
  };
}

export function forecastMeritApr({
  depositUsd,
  forecastAprPercent,
  startDate,
  endDate,
  lastRoundRewardUsd,
  anchorTvlUsd,
}: ForecastMeritCampaignInput): MeritForecastPreview | null {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return null;

  const aprPercent = sanitizePercent(forecastAprPercent);
  if (aprPercent <= 0) return null;

  if (Number.isFinite(anchorTvlUsd) && anchorTvlUsd! > 0) {
    const baseEstimate = computeMeritBaseFromAnchorTvl({
      baseAprPercent: aprPercent,
      anchorTvlUsd: anchorTvlUsd!,
    });
    if (baseEstimate) {
      const hypotheticalTvl = Math.max(baseEstimate.estimatedImpliedTvlUsd + depositUsd, 0);
      if (hypotheticalTvl > 0) {
        return {
          unavailable: false,
          hypotheticalTvl,
          dailyRewards: baseEstimate.estimatedDailyRewardUsd,
          apr: baseEstimate.estimatedDailyRewardUsd * 365 / hypotheticalTvl,
          regime: 'PLANNED',
          isUnderDistributed: false,
          estimateKind: 'TVL_DILUTION',
          meritEstimateSource: 'reserve_tvl',
          anchorTvlUsd: anchorTvlUsd!,
        };
      }
    }
  }

  if (Number.isFinite(lastRoundRewardUsd) && lastRoundRewardUsd! > 0) {
    const baseEstimate = computeMeritBaseEstimate({
      baseAprPercent: aprPercent,
      lastRoundRewardUsd: lastRoundRewardUsd!,
      startDate,
      endDate,
    });
    if (baseEstimate) {
      const hypotheticalTvl = Math.max(baseEstimate.estimatedImpliedTvlUsd + depositUsd, 0);
      if (hypotheticalTvl > 0) {
        return {
          unavailable: false,
          hypotheticalTvl,
          dailyRewards: baseEstimate.estimatedDailyRewardUsd,
          apr: baseEstimate.estimatedDailyRewardUsd * 365 / hypotheticalTvl,
          regime: 'PLANNED',
          isUnderDistributed: false,
          estimateKind: 'TVL_DILUTION',
          meritEstimateSource: 'last_round',
          lastRoundRewardUsd,
        };
      }
    }
  }

  return {
    unavailable: false,
    dailyRewards: (depositUsd * (aprPercent / 100)) / 365,
    apr: aprPercent / 100,
    regime: 'PLANNED',
    isUnderDistributed: false,
    estimateKind: 'CURRENT_RATE',
    usesCurrentRateFallback: true,
  };
}

export function forecastMeritAprPercent(
  groups: MeritCampaignGroup[] | undefined,
  depositUsd: number,
  anchorTvlUsd?: number,
  totalPositionUsd?: number,
): number {
  if (!groups?.length) return 0;

  return groups.reduce((sum, group) => {
    const breakdowns = group.breakdowns ?? [];
    return sum + breakdowns.reduce((bdSum, breakdown) => {
      const aprPercent = sanitizePercent(breakdown.campaignApr);
      const positionCapUsd = breakdown.positionCap;

      if (!Number.isFinite(depositUsd) || depositUsd <= 0) {
        if (positionCapUsd != null && positionCapUsd > 0) {
          const positionForCap = totalPositionUsd ?? 0;
          if (positionForCap > 0) {
            const { aprPercent: effectiveAprPercent } = applyPositionCap(aprPercent, positionForCap, positionCapUsd);
            return bdSum + effectiveAprPercent;
          }
        }
        return bdSum + aprPercent;
      }

      const baseForecast = aprPercent > 0
        ? forecastMeritApr({
            depositUsd,
            forecastAprPercent: aprPercent,
            startDate: breakdown.campaignStartedAt,
            endDate: breakdown.campaignEndedAt,
            anchorTvlUsd,
          })
        : null;

      const fullAfterPercent = baseForecast ? baseForecast.apr * 100 : aprPercent;

      if (positionCapUsd != null && positionCapUsd > 0) {
        const positionForCap = totalPositionUsd ?? depositUsd;
        if (positionForCap > 0) {
          const { aprPercent: effectiveAprPercent } = applyPositionCap(fullAfterPercent, positionForCap, positionCapUsd);
          return bdSum + effectiveAprPercent;
        }
      }

      return bdSum + fullAfterPercent;
    }, 0);
  }, 0);
}
