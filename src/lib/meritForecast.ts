import type { IncentiveMessage, MeritCampaignGroup } from '@/types/aave';
import { computePositionCapEligibility, applyPositionCap } from '@/lib/incentiveMath';
import { parseCampaignBoundaryMs } from '@/lib/campaignGroups';

export type MeritMessage = IncentiveMessage;
export type MeritForecastMode = 'MERIT_BASE' | 'MERIT_SELF_CAP';
export type MeritForecastEstimateKind = MeritForecastMode | 'MERIT_CURRENT_RATE';

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
  positionCapUsd?: number;
  eligibleUsd?: number;
  usesCurrentRateFallback?: boolean;
}

interface ForecastMeritCampaignInput {
  mode: MeritForecastMode;
  depositUsd: number;
  forecastAprPercent?: number;
  startDate?: string;
  endDate?: string;
  lastRoundRewardUsd?: number;
  anchorTvlUsd?: number;
  positionCapUsd?: number;
  baseAprPercent?: number;
  baseLastRoundRewardUsd?: number;
  totalPositionUsd?: number;
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
  mode,
  depositUsd,
  forecastAprPercent,
  startDate,
  endDate,
  lastRoundRewardUsd,
  anchorTvlUsd,
  positionCapUsd,
  baseAprPercent,
  baseLastRoundRewardUsd,
  totalPositionUsd,
}: ForecastMeritCampaignInput): MeritForecastPreview | null {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return null;

  const aprPercent = sanitizePercent(forecastAprPercent);
  if (aprPercent <= 0) return null;

  if (mode === 'MERIT_SELF_CAP') {
    if (!Number.isFinite(positionCapUsd) || positionCapUsd! <= 0) return null;
    const positionForCap = totalPositionUsd ?? depositUsd;
    if (positionForCap <= 0) return null;
    const { eligibleUsd } = computePositionCapEligibility(positionForCap, positionCapUsd!);
    if (eligibleUsd <= 0) return null;

    const latestRoundBaseApr = sanitizePercent(baseAprPercent);
    if (latestRoundBaseApr > 0) {
      type BaseEst = { estimatedDailyRewardUsd: number; estimatedImpliedTvlUsd: number };
      let baseEstimate: BaseEst | null = null;
      let usedReserveTvl = false;
      if (Number.isFinite(anchorTvlUsd) && anchorTvlUsd! > 0) {
        const fromAnchor = computeMeritBaseFromAnchorTvl({
          baseAprPercent: latestRoundBaseApr,
          anchorTvlUsd: anchorTvlUsd!,
        });
        if (fromAnchor) {
          baseEstimate = fromAnchor;
          usedReserveTvl = true;
        }
      }
      if (!baseEstimate && Number.isFinite(baseLastRoundRewardUsd) && baseLastRoundRewardUsd! > 0) {
        baseEstimate = computeMeritBaseEstimate({
          baseAprPercent: latestRoundBaseApr,
          lastRoundRewardUsd: baseLastRoundRewardUsd!,
          startDate,
          endDate,
        });
      }
      if (baseEstimate) {
        const hypotheticalTvl = Math.max(baseEstimate.estimatedImpliedTvlUsd + depositUsd, 0);
        if (hypotheticalTvl > 0) {
          const baseForecastAprPercent = (baseEstimate.estimatedDailyRewardUsd * 365 * 100) / hypotheticalTvl;
          if (Number.isFinite(baseForecastAprPercent) && baseForecastAprPercent > 0) {
            const effectiveAprPercent = baseForecastAprPercent;
            return {
              unavailable: false,
              hypotheticalTvl,
              dailyRewards: (baseForecastAprPercent / 100) * (eligibleUsd / 365),
              apr: effectiveAprPercent / 100,
              regime: 'PLANNED',
              isUnderDistributed: false,
              estimateKind: 'MERIT_SELF_CAP',
              positionCapUsd,
              eligibleUsd: eligibleUsd,
              meritEstimateSource: usedReserveTvl ? 'reserve_tvl' : 'last_round',
              anchorTvlUsd: usedReserveTvl ? anchorTvlUsd : undefined,
            };
          }
        }
      }
    }

    const effectiveAprPercent = aprPercent;
    return {
      unavailable: false,
      dailyRewards: (aprPercent / 100) * (eligibleUsd / 365),
      apr: effectiveAprPercent / 100,
      regime: 'PLANNED',
      isUnderDistributed: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      positionCapUsd,
      eligibleUsd,
      usesCurrentRateFallback: true,
    };
  }

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
          estimateKind: 'MERIT_BASE',
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
          apr: hypotheticalTvl > 0 ? baseEstimate.estimatedDailyRewardUsd * 365 / hypotheticalTvl : 0,
          regime: 'PLANNED',
          isUnderDistributed: false,
          estimateKind: 'MERIT_BASE',
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
    estimateKind: 'MERIT_CURRENT_RATE',
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

      if (positionCapUsd != null && positionCapUsd > 0) {
        const selfForecast = forecastMeritApr({
          mode: 'MERIT_SELF_CAP',
          depositUsd,
          forecastAprPercent: aprPercent,
          positionCapUsd: positionCapUsd,
          startDate: breakdown.campaignStartedAt,
          endDate: breakdown.campaignEndedAt,
          anchorTvlUsd,
          totalPositionUsd,
        });
        const selfAfterPercent = selfForecast
          ? (() => {
              const unscaledPercent = selfForecast.apr * 100;
              if (selfForecast.positionCapUsd != null && selfForecast.positionCapUsd > 0) {
                const positionForCap = totalPositionUsd ?? depositUsd;
                if (positionForCap > 0) {
                  return applyPositionCap(unscaledPercent, positionForCap, selfForecast.positionCapUsd).aprPercent;
                }
              }
              return unscaledPercent;
            })()
          : aprPercent;
        return bdSum + selfAfterPercent;
      }

      const baseForecast = aprPercent > 0
        ? forecastMeritApr({
            mode: 'MERIT_BASE',
            depositUsd,
            forecastAprPercent: aprPercent,
            startDate: breakdown.campaignStartedAt,
            endDate: breakdown.campaignEndedAt,
            anchorTvlUsd,
          })
        : null;

      const baseAfterPercent = baseForecast ? baseForecast.apr * 100 : aprPercent;
      return bdSum + baseAfterPercent;
    }, 0);
  }, 0);
}
