import type { IncentiveMessage, MeritIncentive } from '@/types/aave';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MeritMessage = MeritIncentive['message'];
export type MeritForecastMode = 'MERIT_BASE' | 'MERIT_SELF_CAP';
export type MeritForecastEstimateKind = MeritForecastMode | 'MERIT_CURRENT_RATE';

export interface MeritForecastPreview {
  unavailable: false;
  hypotheticalTvl?: number;
  dailyRewards: number;
  apr: number;
  regime: 'PLANNED';
  isUnderDistributed: false;
  estimateKind: MeritForecastEstimateKind;
  lastRoundRewardUsd?: number;
  selfCapUsd?: number;
  selfEligibleUsd?: number;
  usesCurrentRateFallback?: boolean;
}

interface ForecastMeritCampaignInput {
  mode: MeritForecastMode;
  depositUsd: number;
  forecastAprPercent?: number;
  startDate?: string;
  endDate?: string;
  lastRoundRewardUsd?: number;
  selfCapUsd?: number;
  baseAprPercent?: number;
  baseLastRoundRewardUsd?: number;
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

export function extractMeritSelfCapUsd(message?: MeritMessage): number | null {
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

export function forecastMeritCampaign({
  mode,
  depositUsd,
  forecastAprPercent,
  startDate,
  endDate,
  lastRoundRewardUsd,
  selfCapUsd,
  baseAprPercent,
  baseLastRoundRewardUsd,
}: ForecastMeritCampaignInput): MeritForecastPreview | null {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return null;

  const aprPercent = sanitizePercent(forecastAprPercent);
  if (aprPercent <= 0) return null;

  if (mode === 'MERIT_SELF_CAP') {
    if (!Number.isFinite(selfCapUsd) || selfCapUsd! <= 0) return null;
    const eligibleDepositUsd = Math.min(depositUsd, selfCapUsd!);
    if (eligibleDepositUsd <= 0) return null;

    const latestRoundBaseApr = sanitizePercent(baseAprPercent);
    if (latestRoundBaseApr > 0 && Number.isFinite(baseLastRoundRewardUsd) && baseLastRoundRewardUsd! > 0) {
      const baseEstimate = computeMeritBaseEstimate({
        baseAprPercent: latestRoundBaseApr,
        lastRoundRewardUsd: baseLastRoundRewardUsd!,
        startDate,
        endDate,
      });
      if (baseEstimate) {
        const hypotheticalTvl = Math.max(baseEstimate.estimatedImpliedTvlUsd + depositUsd, 0);
        if (hypotheticalTvl > 0) {
          const baseForecastAprPercent = (baseEstimate.estimatedDailyRewardUsd * 365 * 100) / hypotheticalTvl;
          if (Number.isFinite(baseForecastAprPercent) && baseForecastAprPercent > 0) {
            const effectiveAprPercent = baseForecastAprPercent * (eligibleDepositUsd / depositUsd);
            return {
              unavailable: false,
              hypotheticalTvl,
              dailyRewards: (baseForecastAprPercent / 100) * (eligibleDepositUsd / 365),
              apr: effectiveAprPercent / 100,
              regime: 'PLANNED',
              isUnderDistributed: false,
              estimateKind: 'MERIT_SELF_CAP',
              selfCapUsd,
              selfEligibleUsd: eligibleDepositUsd,
            };
          }
        }
      }
    }

    const effectiveAprPercent = aprPercent * (eligibleDepositUsd / depositUsd);
    return {
      unavailable: false,
      dailyRewards: (aprPercent / 100) * (eligibleDepositUsd / 365),
      apr: effectiveAprPercent / 100,
      regime: 'PLANNED',
      isUnderDistributed: false,
      estimateKind: 'MERIT_CURRENT_RATE',
      selfCapUsd,
      selfEligibleUsd: eligibleDepositUsd,
      usesCurrentRateFallback: true,
    };
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

export function forecastMeritAprPercent(incentive: MeritIncentive, depositUsd: number): number {
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) {
    return sanitizePercent(incentive.apr) + sanitizePercent(incentive.selfApr);
  }

  const baseAprPercent = sanitizePercent(incentive.apr);
  const selfAprPercent = sanitizePercent(incentive.selfApr);
  const { selfMessage } = splitMeritMessageBySelfAuth(incentive.message);
  const selfCapUsd = extractMeritSelfCapUsd(selfMessage);

  const baseForecast = baseAprPercent > 0
    ? forecastMeritCampaign({
        mode: 'MERIT_BASE',
        depositUsd,
        forecastAprPercent: baseAprPercent,
        startDate: incentive.startDate,
        endDate: incentive.endDate,
        lastRoundRewardUsd: incentive.lastRoundRewardUsd,
      })
    : null;

  const selfForecast = selfAprPercent > 0
    ? forecastMeritCampaign({
        mode: 'MERIT_SELF_CAP',
        depositUsd,
        forecastAprPercent: selfAprPercent,
        selfCapUsd: selfCapUsd ?? undefined,
        startDate: incentive.startDate,
        endDate: incentive.endDate,
        baseAprPercent: baseAprPercent > 0 ? baseAprPercent : undefined,
        baseLastRoundRewardUsd: incentive.lastRoundRewardUsd,
      })
    : null;

  const baseAfterPercent = baseForecast ? baseForecast.apr * 100 : baseAprPercent;
  const selfAfterPercent = selfForecast ? selfForecast.apr * 100 : selfAprPercent;
  return baseAfterPercent + selfAfterPercent;
}
