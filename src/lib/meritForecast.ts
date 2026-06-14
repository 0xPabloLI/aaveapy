import type { IncentiveMessage, MeritIncentive } from '@/types/aave';
import { computePositionCapEligibility } from '@/lib/incentiveMath';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MeritMessage = MeritIncentive['message'];
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
  /** When set, Base/self base leg used reserve TVL × APR to fix daily rewards (see `anchorTvlUsd`). */
  meritEstimateSource?: MeritEstimateSource;
  /** Reserve-side USD TVL assumed equal to Merit’s denominator when using `reserve_tvl`. */
  anchorTvlUsd?: number;
  lastRoundRewardUsd?: number;
  selfPositionCapUsd?: number;
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
  /** If set, assumes this USD TVL matches Merit's rate denominator; daily reward = TVL × APR / 365, then dilutes. */
  anchorTvlUsd?: number;
  selfPositionCapUsd?: number;
  baseAprPercent?: number;
  baseLastRoundRewardUsd?: number;
  /** Total position USD (existing wallet position + delta). Used for self-cap eligibility check
   *  so that cap dilution accounts for the full position, not just the incremental input. */
  totalPositionUsd?: number;
}

function sanitizePercent(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? value! : 0;
}

function parseCampaignBoundaryMs(value: string | undefined, boundary: 'start' | 'end'): number | null {
  if (!value) return null;
  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function flattenMessageLines(message?: MeritMessage): string[] {
  if (!message) return [];
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) {
    return message.flatMap((item) => flattenMessageLines(item as MeritMessage));
  }
  if (typeof message === 'object') {
    return Object.values(message).flatMap((value) => flattenMessageLines(value as MeritMessage));
  }
  return [];
}

export function splitMeritMessageBySelfAuth(message?: MeritMessage): {
  baseMessage?: MeritMessage;
  selfMessage?: MeritMessage;
} {
  if (!Array.isArray(message)) {
    return { baseMessage: message };
  }

  const base: IncentiveMessage[] = [];
  const self: IncentiveMessage[] = [];
  for (const item of message) {
    const text = typeof item === 'object' && item ? JSON.stringify(item).toLowerCase() : String(item ?? '').toLowerCase();
    if (text.includes('self authentication')) {
      self.push(item);
    } else {
      base.push(item);
    }
  }

  return {
    baseMessage: base.length > 0 ? base : undefined,
    selfMessage: self.length > 0 ? self : undefined,
  };
}

export function extractMeritSelfPositionCapUsd(message?: MeritMessage): number | null {
  const lines = flattenMessageLines(message);
  for (const line of lines) {
    if (!line.toLowerCase().includes('self')) continue;
    const match = line.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    if (!match) continue;
    const parsed = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
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

/**
 * Assume headline Base APR applies to `anchorTvlUsd` (e.g. reserve supply or borrowed USD).
 * Then implied daily reward is fixed; adding `depositUsd` dilutes APR like Merkl fixed-reward intuition.
 */
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

export function forecastMeritCampaign({
  mode,
  depositUsd,
  forecastAprPercent,
  startDate,
  endDate,
  lastRoundRewardUsd,
  anchorTvlUsd,
  selfPositionCapUsd,
  baseAprPercent,
  baseLastRoundRewardUsd,
  totalPositionUsd,
}: ForecastMeritCampaignInput): MeritForecastPreview | null {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return null;

  const aprPercent = sanitizePercent(forecastAprPercent);
  if (aprPercent <= 0) return null;

  if (mode === 'MERIT_SELF_CAP') {
    if (!Number.isFinite(selfPositionCapUsd) || selfPositionCapUsd! <= 0) return null;
    const positionForCap = totalPositionUsd ?? depositUsd;
    if (positionForCap <= 0) return null;
    const { eligibleUsd } = computePositionCapEligibility(positionForCap, selfPositionCapUsd!);
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
            const effectiveAprPercent = baseForecastAprPercent * (eligibleUsd / positionForCap);
            return {
              unavailable: false,
              hypotheticalTvl,
              dailyRewards: (baseForecastAprPercent / 100) * (eligibleUsd / 365),
              apr: effectiveAprPercent / 100,
              regime: 'PLANNED',
              isUnderDistributed: false,
              estimateKind: 'MERIT_SELF_CAP',
              selfPositionCapUsd,
              eligibleUsd: eligibleUsd,
              meritEstimateSource: usedReserveTvl ? 'reserve_tvl' : 'last_round',
              anchorTvlUsd: usedReserveTvl ? anchorTvlUsd : undefined,
            };
          }
        }
      }
    }

    const effectiveAprPercent = aprPercent * (eligibleUsd / positionForCap);
    return {
      unavailable: false,
      dailyRewards: (aprPercent / 100) * (eligibleUsd / 365),
      apr: effectiveAprPercent / 100,
      regime: 'PLANNED',
      isUnderDistributed: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      selfPositionCapUsd,
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
  incentive: MeritIncentive,
  depositUsd: number,
  anchorTvlUsd?: number,
  totalPositionUsd?: number,
): number {
  const baseAprPercent = sanitizePercent(incentive.apr);
  const selfAprPercent = sanitizePercent(incentive.selfApr);

  // When depositUsd <= 0, skip BASE forecasting (no new deposit to dilute TVL),
  // but still apply self-cap dilution if totalPositionUsd is provided.
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) {
    const { selfMessage } = splitMeritMessageBySelfAuth(incentive.message);
    const selfPositionCapUsd = extractMeritSelfPositionCapUsd(selfMessage);
    const positionForCap = totalPositionUsd ?? 0;
    if (selfPositionCapUsd != null && selfPositionCapUsd > 0 && positionForCap > 0) {
      const { eligibleUsd } = computePositionCapEligibility(positionForCap, selfPositionCapUsd);
      const effectiveAprPercent = selfAprPercent * (eligibleUsd / positionForCap);
      return baseAprPercent + effectiveAprPercent;
    }
    return baseAprPercent + selfAprPercent;
  }

  const { selfMessage } = splitMeritMessageBySelfAuth(incentive.message);
  const selfPositionCapUsd = extractMeritSelfPositionCapUsd(selfMessage);

  const baseForecast = baseAprPercent > 0
    ? forecastMeritCampaign({
        mode: 'MERIT_BASE',
        depositUsd,
        forecastAprPercent: baseAprPercent,
        startDate: incentive.startDate,
        endDate: incentive.endDate,
        lastRoundRewardUsd: incentive.lastRoundRewardUsd,
        anchorTvlUsd,
      })
    : null;

  const selfForecast = selfAprPercent > 0
    ? forecastMeritCampaign({
        mode: 'MERIT_SELF_CAP',
        depositUsd,
        forecastAprPercent: selfAprPercent,
        selfPositionCapUsd: selfPositionCapUsd ?? undefined,
        startDate: incentive.startDate,
        endDate: incentive.endDate,
        baseAprPercent: baseAprPercent > 0 ? baseAprPercent : undefined,
        baseLastRoundRewardUsd: incentive.lastRoundRewardUsd,
        anchorTvlUsd,
        totalPositionUsd,
      })
    : null;

  const baseAfterPercent = baseForecast ? baseForecast.apr * 100 : baseAprPercent;
  const selfAfterPercent = selfForecast ? selfForecast.apr * 100 : selfAprPercent;
  return baseAfterPercent + selfAfterPercent;
}
