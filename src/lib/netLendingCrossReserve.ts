import type { NetPositionConstraint, CrossAssetPairing } from '@/types/aave';

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

// ============================================================
// AAV-895: Cross-Asset Pairing (min(1,2))
//
// Unlike NetPositionConstraint (subtraction: source - Σoffset),
// cross-asset pairing uses min(): min(sourcePos, pairedPos × discountFactor).
// Mutually exclusive with netPositionConstraint on the same opportunity.
// ============================================================

export interface CrossAssetNetInput {
  sourceGrossUsd: number;
  pairing: CrossAssetPairing;
  crossReservePositions: Map<string, ReservePositions>;
}

/**
 * Compute the effective (net eligible) position for a cross-asset pairing opportunity.
 *
 * Formula: min(sourceGrossUsd, pairedUsd × discountFactor)
 *
 * - sourceGrossUsd: the source side gross position (supply or borrow USD)
 * - pairedUsd: looked up from crossReservePositions by pairedReserveId + pairedSide
 * - discountFactor: paired-side multiplier (e.g. 0.823 for cbETH, 1.196 for sUSDe)
 *
 * If paired reserve is not in the Map, pairedUsd = 0 → result = 0.
 */
export function computeCrossAssetNetEligible(input: CrossAssetNetInput): number {
  const { sourceGrossUsd, pairing, crossReservePositions } = input;
  const pairedPos = crossReservePositions.get(pairing.pairedReserveId);
  const pairedUsd = pairing.pairedSide === 'supply'
    ? (pairedPos?.supplyUsd ?? 0)
    : (pairedPos?.borrowUsd ?? 0);
  return Math.min(sourceGrossUsd, pairedUsd * pairing.discountFactor);
}

/**
 * Compute the eligibility ratio for a cross-asset pairing opportunity.
 *
 * ratio = netEligible / sourceGrossUsd
 *
 * Returns 1 when sourceGrossUsd <= 0 (consistent with computeCrossReserveEligibilityRatio,
 * avoids divide-by-zero).
 */
export function computeCrossAssetEligibilityRatio(input: CrossAssetNetInput): number {
  if (input.sourceGrossUsd <= 0) return 1;
  return computeCrossAssetNetEligible(input) / input.sourceGrossUsd;
}
