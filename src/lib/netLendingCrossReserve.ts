import type { NetPositionConstraint } from '@/types/aave';
import type { PerReserveInput } from '@/lib/portfolioSimulator';

export interface ReservePositions {
  supplyUsd: number;
  borrowUsd: number;
}

/** Build cross-reserve position map from portfolio per-reserve inputs.
 *  Only call in Portfolio mode where PerReserveInput contains totalSupplyUsd/totalBorrowUsd (wallet+delta).
 *  In Single simulation mode these fields are undefined — the function would return undefined (all positions treated as 0). */
export function buildCrossReservePositionsFromPerReserveInputs(
  perReserveInputs: Map<string, PerReserveInput>,
): Map<string, ReservePositions> | undefined {
  const map = new Map<string, ReservePositions>();
  for (const [reserveId, input] of perReserveInputs) {
    const supplyUsd = input.totalSupplyUsd ?? 0;
    const borrowUsd = input.totalBorrowUsd ?? 0;
    if (supplyUsd > 0 || borrowUsd > 0) {
      map.set(reserveId, { supplyUsd, borrowUsd });
    }
  }
  return map.size > 0 ? map : undefined;
}

export interface CrossReserveNetInput {
  sourceSide: 'supply' | 'borrow';
  sourceGrossUsd: number;
  constraint: NetPositionConstraint | undefined | null;
  crossReservePositions: Map<string, ReservePositions>;
}

export function computeCrossReserveNetEligible(input: CrossReserveNetInput): number {
  const { sourceSide, sourceGrossUsd, constraint, crossReservePositions } = input;

  if (!constraint || constraint.offsetReserveIds.length === 0) {
    return sourceGrossUsd;
  }

  let offsetTotal = 0;
  for (const reserveId of constraint.offsetReserveIds) {
    const pos = crossReservePositions.get(reserveId);
    if (!pos) continue;
    offsetTotal += sourceSide === 'supply' ? pos.borrowUsd : pos.supplyUsd;
  }

  return Math.max(sourceGrossUsd - offsetTotal, 0);
}

export function computeCrossReserveEligibilityRatio(input: CrossReserveNetInput): number {
  const { sourceGrossUsd } = input;
  if (sourceGrossUsd <= 0) return 1;

  const netEligible = computeCrossReserveNetEligible(input);
  return netEligible / sourceGrossUsd;
}
