import type { NetPositionConstraint } from '@/types/aave';

export interface ReservePositions {
  supplyUsd: number;
  borrowUsd: number;
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
