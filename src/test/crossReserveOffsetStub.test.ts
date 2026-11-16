import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CROSS_RESERVE_OFFSET_FIXTURE_URL,
  CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID,
  CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID,
  buildCrossReserveOffsetStub,
} from '../../e2e/crossReserveOffsetStub';

/**
 * AAV-1333 — the synthetic cross-reserve payload must produce a REAL,
 * derivable scenario. Its whole purpose is to replace "always skipped" with
 * "actually executed", so every assertion here doubles as a fail-loud gate on
 * the committed fixture.
 */

function fixture(): unknown {
  return JSON.parse(readFileSync(CROSS_RESERVE_OFFSET_FIXTURE_URL, 'utf8')) as unknown;
}

describe('buildCrossReserveOffsetStub (AAV-1333)', () => {
  it('S1: discovers exactly one cross-reserve scenario on the committed payload', () => {
    const stub = buildCrossReserveOffsetStub(fixture());
    expect(stub.scenario.type).toBe('cross-reserve');
    expect(stub.scenario.targetReserveId).toBe(CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID);
    expect(stub.scenario.offsetReserveId).toBe(CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID);
  });

  it('S2: derives the documented ladder from the fixture LTV and rooms', () => {
    // Base USDC: ltv 75, supply room ≈ $47.8M, borrow room ≈ $42.4M
    // ⇒ funding $100k, capacity min(42.4M, 75k) = 75k, gross = capacity/2 = 37.5k
    const { plan } = buildCrossReserveOffsetStub(fixture()).scenario;
    expect(plan).toMatchObject({
      targetSupplyUsd: 37_500,
      offsetSupplyUsd: 100_000,
      offsetCapacityUsd: 75_000,
    });
    expect(plan.steps.map((s) => s.borrowUsd)).toEqual([9_375, 18_750, 56_250]);
    expect(plan.steps.map((s) => s.expectedDecreaseRatio)).toEqual([0.25, 0.5, 1]);
    // 1.5 × gross exceeds gross ⇒ the eligible position floors at 0.
    expect(plan.steps.map((s) => s.expectedAfterZero)).toEqual([false, false, true]);
  });

  it('S3: the payload keeps the fixture shape the browser validates', () => {
    const { payload } = buildCrossReserveOffsetStub(fixture());
    expect(payload.snapshot.lastUpdated).toBeTruthy();
    expect(payload.reserves.map((r) => r.tokenSymbol)).toEqual(['WETH', 'USDC']);
    // The INJECTED constraint is the only synthetic field.
    const groups = payload.reserves[0].merklSupplys as unknown[];
    expect(groups).toHaveLength(1);
    expect((groups[0] as { netPositionConstraint?: unknown }).netPositionConstraint).toEqual({
      sourceSide: 'supply',
      offsetReserveIds: [CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID],
    });
  });

  it('S4: a payload without the constraint fails loudly instead of skipping', () => {
    const base = fixture() as { reserves: Array<{ merklSupplys: Array<{ netPositionConstraint: unknown }> }> };
    base.reserves[0].merklSupplys[0].netPositionConstraint = null;
    expect(() => buildCrossReserveOffsetStub(base)).toThrow(/carries no netPositionConstraint/);
  });

  it('S5: an empty payload fails loudly', () => {
    expect(() => buildCrossReserveOffsetStub({ snapshot: {}, reserves: [] })).toThrow(/non-empty reserves array/);
    expect(() => buildCrossReserveOffsetStub(null)).toThrow(/must be an object/);
  });

  it('S6: a constraint pointing at the wrong reserve fails loudly', () => {
    const base = fixture() as {
      reserves: Array<{ merklSupplys: Array<{ netPositionConstraint: { offsetReserveIds: string[] } }> }>;
    };
    base.reserves[0].merklSupplys[0].netPositionConstraint.offsetReserveIds = ['0xother'];
    expect(() => buildCrossReserveOffsetStub(base)).toThrow(/does not point at the documented Base USDC/);
  });
});
