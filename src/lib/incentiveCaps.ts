import { formatUsd } from '@/lib/formatters';
import { applyPositionCap, computeBudgetRemainingDays } from '@/lib/incentiveMath';

/**
 * Domain-layer model for incentive constraints that surface as simulation `capNote` / `capWarning`.
 * API field names stay unchanged (e.g. `positionCap`); UI props stay `capNote` / `capWarning`.
 */
export type IncentiveCapKind =
  | 'position_cap'
  | 'pool_budget'
  | 'apr_cap';

export type IncentiveCapScope = 'per_user' | 'pool' | 'unspecified';

export type IncentiveCapWindow = 'round_cycle' | 'campaign_lifetime' | 'unknown';

export interface IncentiveCapEffect {
  kind: IncentiveCapKind;
  scope: IncentiveCapScope;
  window: IncentiveCapWindow;
  noteParts: string[];
  warning: boolean;
  metrics?: {
    positionCapUsd?: number;
    eligibleUsd?: number;
    remainingDays?: number | null;
    isCombineCap?: boolean;
  };
}

export interface SimulationCapMetrics {
  positionCapUsd?: number;
  isCombineCap?: boolean;
}

export function capEffectToSimulationFields(
  effect: IncentiveCapEffect,
): { capNote: string; capWarning: boolean; capMetrics?: SimulationCapMetrics } {
  let capMetrics: SimulationCapMetrics | undefined;
  if (effect.kind === 'position_cap' && effect.metrics?.positionCapUsd != null) {
    capMetrics = { positionCapUsd: effect.metrics.positionCapUsd };
    if (effect.metrics.isCombineCap) {
      capMetrics.isCombineCap = true;
    }
  }
  return {
    capNote: effect.noteParts.join(' · '),
    capWarning: effect.warning,
    capMetrics,
  };
}

/** Per-user position cap from API `positionCap`. Shared by Brevis and Merit (via `applyPositionCapToForecastResult`). */
export function buildPositionCapEffect(input: {
  positionCapUsd: number;
  isCombineCap: boolean;
  isCapBinding: boolean;
  remainingBudget: number | null;
  dailyRewardUsd: number | null;
  remainingDays: number | null;
}): IncentiveCapEffect {
  const parts: string[] = [];
  parts.push(
    input.isCombineCap
      ? `Incentive on first ${formatUsd(input.positionCapUsd)} · combine`
      : `Incentive on first ${formatUsd(input.positionCapUsd)}`,
  );
  if (input.remainingBudget != null && input.dailyRewardUsd != null && input.remainingDays != null) {
    const earnDays = computeBudgetRemainingDays(input.remainingBudget, input.dailyRewardUsd, input.remainingDays);
    if (earnDays > 0) {
      parts.push(`~${earnDays.toFixed(0)}d earn`);
    }
  } else if (input.remainingDays != null && input.remainingDays > 0) {
    parts.push(`~${input.remainingDays.toFixed(0)}d to end`);
  }
  return {
    kind: 'position_cap',
    scope: 'per_user',
    window: 'campaign_lifetime',
    noteParts: parts,
    warning: input.isCapBinding,
    metrics: {
      positionCapUsd: input.positionCapUsd,
      remainingDays: input.remainingDays,
      isCombineCap: input.isCombineCap || undefined,
    },
  };
}

/**
 * FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE (and TARGET_TOTAL_APR + FIX_APR): pool budget horizon.
 * Uses the same **`~Nd earn`** surface copy as position-cap notes; semantics differ (pool budget vs per-user position cap).
 */
export function buildFixRewardCapEffect(fixRewardableDays: number): IncentiveCapEffect {
  return {
    kind: 'pool_budget',
    scope: 'pool',
    window: 'campaign_lifetime',
    noteParts: [`~${fixRewardableDays < 1 ? fixRewardableDays.toFixed(2) : fixRewardableDays.toFixed(0)}d earn`],
    warning: false,
  };
}

/** MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE (and TARGET_TOTAL_APR + MAX_APR): APR capped regime for low TVL. */
export function buildMaxRewardCapEffect(): IncentiveCapEffect {
  return {
    kind: 'apr_cap',
    scope: 'pool',
    window: 'unknown',
    noteParts: ['APR capped for low TVL'],
    warning: true,
  };
}

/** Net eligible note: effective incentive is discounted because only the net portion (supply - borrow) is eligible. */
export function buildNetEligibleNote(netUsd: number, grossUsd: number): string | null {
  if (grossUsd <= 0 || netUsd >= grossUsd) return null;
  return `Net eligible ${formatUsd(netUsd)} of ${formatUsd(grossUsd)}`;
}

export interface CrossReserveNetNoteInput {
  netUsd: number;
  grossUsd: number;
  sourceSide: 'supply' | 'borrow';
  offsetSymbols: string[];
}

export interface PositionCapForecastResult {
  aprPercent: number;
  capNote?: string;
  capWarning: boolean;
  capMetrics?: SimulationCapMetrics;
}

export function applyPositionCapToForecastResult(
  nominalAprPercent: number,
  positionUsd: number,
  capUsd: number | undefined,
  options?: {
    isCombineCap?: boolean;
    remainingBudget?: number | null;
    dailyRewardUsd?: number | null;
    remainingDays?: number | null;
  },
): PositionCapForecastResult {
  if (capUsd === undefined || capUsd <= 0 || positionUsd <= 0) {
    return { aprPercent: nominalAprPercent, capWarning: false };
  }
  const { aprPercent, isCapBinding, eligibleUsd } = applyPositionCap(nominalAprPercent, positionUsd, capUsd);
  const effect = buildPositionCapEffect({
    positionCapUsd: capUsd,
    isCombineCap: options?.isCombineCap ?? false,
    isCapBinding,
    remainingBudget: options?.remainingBudget ?? null,
    dailyRewardUsd: options?.dailyRewardUsd ?? null,
    remainingDays: options?.remainingDays ?? null,
  });
  const fields = capEffectToSimulationFields(effect);
  return { aprPercent, ...fields };
}

export function appendNotes(
  note: string | undefined,
  crossReserveNote: string | null | undefined,
  netNote: string | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (note) parts.push(note);
  if (crossReserveNote) parts.push(crossReserveNote);
  if (netNote) parts.push(netNote);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function checkForecastAvailability(
  campaignType: string | undefined,
  campaignId: string | undefined,
  merged: unknown,
  forecastStates: Record<string, unknown> | undefined,
): boolean {
  if (!campaignType) return false;
  return merged == null || !forecastStates?.[String(campaignId)];
}

export function buildCrossReserveNetEligibleNote(input: CrossReserveNetNoteInput): string | null {
  const { netUsd, grossUsd, sourceSide, offsetSymbols } = input;
  if (grossUsd <= 0 || netUsd >= grossUsd) return null;
  const sideLabel = sourceSide === 'supply' ? 'supply' : 'borrow';
  const offsets = offsetSymbols.length > 0 ? ` minus ${offsetSymbols.join('+')} ${sourceSide === 'supply' ? 'borrows' : 'supplies'}` : '';
  return `Net eligible ${formatUsd(netUsd)} of ${formatUsd(grossUsd)} (${sideLabel}${offsets})`;
}
