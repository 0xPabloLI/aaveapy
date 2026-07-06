import { formatUsd } from '@/lib/formatters';
import { applyPositionCap, computeBudgetRemainingDays } from '@/lib/incentiveMath';

export type IncentiveNoteType = 'position_cap' | 'pool_budget' | 'apr_cap' | 'net_eligible';

export type IncentiveNoteColor = 'amber' | 'muted';

export interface IncentiveNote {
  type: IncentiveNoteType;
  text: string;
  color: IncentiveNoteColor;
}

/**
 * Domain-layer model for incentive constraints that surface as `IncentiveNote[]` on campaigns/sources.
 * API field names stay unchanged (e.g. `positionCap`).
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

const CAP_KIND_TO_NOTE_TYPE: Record<IncentiveCapKind, IncentiveNoteType> = {
  position_cap: 'position_cap',
  pool_budget: 'pool_budget',
  apr_cap: 'apr_cap',
};

export function capEffectToNote(effect: IncentiveCapEffect): IncentiveNote {
  return {
    type: CAP_KIND_TO_NOTE_TYPE[effect.kind],
    text: effect.noteParts.join(' · '),
    color: effect.warning ? 'amber' : 'muted',
  };
}

export function netEligibleToNote(text: string): IncentiveNote {
  return { type: 'net_eligible', text, color: 'muted' };
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
  const capPrefix = `Incentive limited to first ${formatUsd(input.positionCapUsd)}`;
  parts.push(
    input.isCombineCap
      ? `${capPrefix} · combined supply + borrow`
      : capPrefix,
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
  return `${formatUsd(netUsd)} of ${formatUsd(grossUsd)} net eligible`;
}

export interface CrossReserveNetNoteInput {
  netUsd: number;
  grossUsd: number;
  sourceSide: 'supply' | 'borrow';
  offsetSymbols: string[];
}

export interface PositionCapForecastResult {
  aprPercent: number;
  notes?: IncentiveNote[];
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
    return { aprPercent: nominalAprPercent };
  }
  const { aprPercent, isCapBinding } = applyPositionCap(nominalAprPercent, positionUsd, capUsd);
  const effect = buildPositionCapEffect({
    positionCapUsd: capUsd,
    isCombineCap: options?.isCombineCap ?? false,
    isCapBinding,
    remainingBudget: options?.remainingBudget ?? null,
    dailyRewardUsd: options?.dailyRewardUsd ?? null,
    remainingDays: options?.remainingDays ?? null,
  });
  const notes = [capEffectToNote(effect)];
  let capMetrics: SimulationCapMetrics | undefined;
  if (effect.metrics?.positionCapUsd != null) {
    capMetrics = { positionCapUsd: effect.metrics.positionCapUsd };
    if (effect.metrics.isCombineCap) {
      capMetrics.isCombineCap = true;
    }
  }
  return { aprPercent, notes, capMetrics };
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
  return `${formatUsd(netUsd)} of ${formatUsd(grossUsd)} net eligible (${sideLabel}${offsets})`;
}
