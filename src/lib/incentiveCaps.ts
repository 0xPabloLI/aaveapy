import { formatUsd } from '@/lib/formatters';
import { applyPositionCap, computeBudgetRemainingDays } from '@/lib/incentiveMath';

/**
 * Domain-layer model for incentive constraints that surface as simulation `capNote` / `capWarning`.
 * API field names stay unchanged (e.g. `positionCap`); UI props stay `capNote` / `capWarning`.
 */
export type IncentiveCapKind =
  | 'position_cap'
  | 'pool_budget'
  | 'apr_cap'
  | 'informational';

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
    isSharedSupplyBorrow?: boolean;
  };
}

export interface SimulationCapMetrics {
  positionCapUsd?: number;
  isSharedSupplyBorrow?: boolean;
}

export function capEffectToSimulationFields(
  effect: IncentiveCapEffect,
): { capNote: string; capWarning: boolean; capMetrics?: SimulationCapMetrics } {
  let capMetrics: SimulationCapMetrics | undefined;
  if (effect.kind === 'position_cap' && effect.metrics?.positionCapUsd != null) {
    capMetrics = { positionCapUsd: effect.metrics.positionCapUsd };
    if (effect.metrics.isSharedSupplyBorrow) {
      capMetrics.isSharedSupplyBorrow = true;
    }
  }
  return {
    capNote: effect.noteParts.join(' · '),
    capWarning: effect.warning,
    capMetrics,
  };
}

/** Merit Self Authentication: only the first `positionCapUsd` of position earns incentive. */
export function buildMeritPositionCapEffect(input: {
  inputUsd: number;
  eligibleUsd: number;
  positionCapUsd: number;
}): IncentiveCapEffect {
  const { inputUsd, eligibleUsd, positionCapUsd } = input;
  return {
    kind: 'position_cap',
    scope: 'per_user',
    window: 'round_cycle',
    noteParts: [`Incentive on first ${formatUsd(positionCapUsd)}`],
    warning: inputUsd > positionCapUsd,
    metrics: {
      positionCapUsd,
      eligibleUsd,
    },
  };
}

/** Brevis: per-user position cap from API `positionCap`. */
export function buildBrevisPositionCapEffect(input: {
  positionCapUsd: number;
  isSharedSupplyBorrow: boolean;
  isCapBinding: boolean;
  remainingBudget: number | null;
  dailyRewardUsd: number | null;
  remainingDays: number | null;
}): IncentiveCapEffect {
  const parts: string[] = [];
  parts.push(
    input.isSharedSupplyBorrow
      ? `Incentive on first ${formatUsd(input.positionCapUsd)} · supply + borrow`
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
      isSharedSupplyBorrow: input.isSharedSupplyBorrow || undefined,
    },
  };
}

/** Brevis: no per-user cap in payload; calendar window only. */
export function buildBrevisCalendarEndOnlyEffect(remainingDays: number): IncentiveCapEffect {
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
 * Uses the same **`~Nd earn`** surface copy as Brevis position-cap notes; semantics differ (pool budget vs per-user position cap).
 */
export function buildMerklFixPoolBudgetEffect(fixRewardableDays: number): IncentiveCapEffect {
  return {
    kind: 'pool_budget',
    scope: 'pool',
    window: 'campaign_lifetime',
    noteParts: [`~${fixRewardableDays < 1 ? fixRewardableDays.toFixed(2) : fixRewardableDays.toFixed(0)}d earn`],
    warning: false,
  };
}

/** Merkl MAX: APR capped regime for low TVL. */
export function buildMerklAprCapEffect(): IncentiveCapEffect {
  return {
    kind: 'apr_cap',
    scope: 'pool',
    window: 'unknown',
    noteParts: ['APR capped for low TVL'],
    warning: true,
  };
}

/** Net position eligibility: effective incentive is discounted because only the net portion is eligible. */
export function buildNetEligibilityNote(netUsd: number, grossUsd: number): string | null {
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
    isSharedSupplyBorrow?: boolean;
    remainingBudget?: number | null;
    dailyRewardUsd?: number | null;
    remainingDays?: number | null;
  },
): PositionCapForecastResult {
  if (capUsd === undefined || capUsd <= 0 || positionUsd <= 0) {
    return { aprPercent: nominalAprPercent, capWarning: false };
  }
  const { aprPercent, isCapBinding, eligibleUsd } = applyPositionCap(nominalAprPercent, positionUsd, capUsd);
  const effect = buildBrevisPositionCapEffect({
    positionCapUsd: capUsd,
    isSharedSupplyBorrow: options?.isSharedSupplyBorrow ?? false,
    isCapBinding,
    remainingBudget: options?.remainingBudget ?? null,
    dailyRewardUsd: options?.dailyRewardUsd ?? null,
    remainingDays: options?.remainingDays ?? null,
  });
  const fields = capEffectToSimulationFields(effect);
  return { aprPercent, ...fields };
}

export function buildCrossReserveNetEligibilityNote(input: CrossReserveNetNoteInput): string | null {
  const { netUsd, grossUsd, sourceSide, offsetSymbols } = input;
  if (grossUsd <= 0 || netUsd >= grossUsd) return null;
  const sideLabel = sourceSide === 'supply' ? 'supply' : 'borrow';
  const offsets = offsetSymbols.length > 0 ? ` minus ${offsetSymbols.join('+')} ${sourceSide === 'supply' ? 'borrows' : 'supplies'}` : '';
  return `Net eligible ${formatUsd(netUsd)} of ${formatUsd(grossUsd)} (${sideLabel}${offsets})`;
}
