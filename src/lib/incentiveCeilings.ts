import { formatUsd } from '@/lib/formatters';

/**
 * Domain-layer model for incentive constraints that surface as simulation `capNote` / `capWarning`.
 * API field names stay unchanged (e.g. `perUserRewardCapUsd`); UI props stay `capNote` / `capWarning`.
 */
export type IncentiveCeilingKind =
  | 'deposit_ceiling'
  | 'reward_ceiling'
  | 'pool_budget'
  | 'apr_ceiling'
  | 'informational';

export type IncentiveCeilingScope = 'per_user' | 'pool' | 'unspecified';

export type IncentiveCeilingWindow = 'round_cycle' | 'campaign_lifetime' | 'unknown';

export interface IncentiveCeilingEffect {
  kind: IncentiveCeilingKind;
  scope: IncentiveCeilingScope;
  window: IncentiveCeilingWindow;
  noteParts: string[];
  warning: boolean;
  metrics?: {
    depositCeilingUsd?: number;
    rewardCeilingUsd?: number;
    eligibleDepositUsd?: number;
    daysToHitCeiling?: number | null;
    remainingDays?: number | null;
  };
}

export function ceilingEffectToSimulationFields(
  effect: IncentiveCeilingEffect,
): { capNote: string; capWarning: boolean } {
  return {
    capNote: effect.noteParts.join(' · '),
    capWarning: effect.warning,
  };
}

/** Merit Self Authentication: eligible deposit is capped (parsed as `selfCapUsd` in meritForecast). */
export function buildMeritSelfDepositCeilingEffect(input: {
  inputUsd: number;
  selfEligibleUsd: number;
  depositCeilingUsd: number;
}): IncentiveCeilingEffect {
  const { inputUsd, selfEligibleUsd, depositCeilingUsd } = input;
  return {
    kind: 'deposit_ceiling',
    scope: 'per_user',
    window: 'round_cycle',
    noteParts: [`Eligible deposit capped at ${formatUsd(depositCeilingUsd)}`],
    warning: inputUsd > depositCeilingUsd,
    metrics: {
      depositCeilingUsd,
      eligibleDepositUsd: selfEligibleUsd,
    },
  };
}

function computeBrevisEarnDays(
  daysToHitCap: number | null,
  remainingDays: number | null,
): number | null {
  const capDays =
    daysToHitCap !== null && Number.isFinite(daysToHitCap) && daysToHitCap > 0 ? daysToHitCap : null;
  const endDays =
    remainingDays !== null && Number.isFinite(remainingDays) && remainingDays > 0 ? remainingDays : null;
  if (capDays !== null && endDays !== null) return Math.min(capDays, endDays);
  if (capDays !== null) return capDays;
  if (endDays !== null) return endDays;
  return null;
}

/** Brevis: per-user cumulative reward ceiling from API `perUserRewardCapUsd`. */
export function buildBrevisRewardCeilingEffect(input: {
  rewardCeilingUsd: number;
  isSharedSupplyBorrow: boolean;
  isCapBinding: boolean;
  daysToHitCap: number | null;
  remainingDays: number | null;
}): IncentiveCeilingEffect {
  const parts: string[] = [];
  parts.push(
    input.isSharedSupplyBorrow
      ? `Reward capped at ${formatUsd(input.rewardCeilingUsd)}/user · supply + borrow`
      : `Reward capped at ${formatUsd(input.rewardCeilingUsd)}/user`,
  );
  const earnDays = computeBrevisEarnDays(input.daysToHitCap, input.remainingDays);
  if (earnDays !== null) {
    parts.push(`~${earnDays.toFixed(0)}d earn`);
  }
  return {
    kind: 'reward_ceiling',
    scope: 'per_user',
    window: 'campaign_lifetime',
    noteParts: parts,
    warning: input.isCapBinding,
    metrics: {
      rewardCeilingUsd: input.rewardCeilingUsd,
      daysToHitCeiling: input.daysToHitCap,
      remainingDays: input.remainingDays,
    },
  };
}

/** Brevis: no per-user cap in payload; calendar window only. */
export function buildBrevisCalendarEndOnlyEffect(remainingDays: number): IncentiveCeilingEffect {
  return {
    kind: 'informational',
    scope: 'unspecified',
    window: 'unknown',
    noteParts: [`~${remainingDays.toFixed(0)}d to end`],
    warning: false,
    metrics: { remainingDays },
  };
}

/**
 * Merkl FIX: pool budget horizon at hypothetical TVL (scenario deposit folded into `forecastWithTVL`).
 * Uses the same **`~Nd earn`** surface copy as Brevis reward-horizon notes; semantics differ (pool budget vs per-user cap).
 */
export function buildMerklFixPoolBudgetEffect(fixRewardableDays: number): IncentiveCeilingEffect {
  return {
    kind: 'pool_budget',
    scope: 'pool',
    window: 'campaign_lifetime',
    noteParts: [`~${fixRewardableDays.toFixed(0)}d earn`],
    warning: false,
  };
}

/** Merkl MAX: APR capped regime for low TVL. */
export function buildMerklAprCeilingEffect(): IncentiveCeilingEffect {
  return {
    kind: 'apr_ceiling',
    scope: 'pool',
    window: 'unknown',
    noteParts: ['APR capped for low TVL'],
    warning: true,
  };
}
