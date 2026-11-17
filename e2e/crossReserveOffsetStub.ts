import { discoverOffsetScenarios, type DiscoveryReserve, type OffsetScenario } from './reserveDiscovery';

/**
 * AAV-1333 — synthetic cross-reserve offset payload.
 *
 * `netPositionConstraint` (Merkl net-lending cross-reserve campaigns) is the
 * only shape that exercises the cross-reserve offset ladder, and staging has
 * carried ZERO of them on every capture so far (2026-11-16: 441 reserves, 0
 * cross-reserve, 1 self-loop). Without a payload the cross-reserve half of
 * `portfolio-cross-reserve-offset.desktop.spec.ts` /
 * `.mobile.spec.ts` could never execute — the ladder
 * that AAV-1333 exists to fix was only ever type-checked, never run.
 *
 * This module turns a committed REAL `/markets` payload into a stub with TWO
 * injections — the `netPositionConstraint` that makes the ladder cross-reserve,
 * and (AAV-1395) a second, unconstrained campaign group cloned from the real
 * one so the plan's `weight = responding / total` is 0.5. Without the second
 * group the ladder could only ever run at weight = 1, leaving the dilution path
 * covered by `planOffsetRunner`'s own unit tests alone. It then re-runs the REAL
 * discovery gates (`discoverOffsetScenarios`) on the payload, so the runner
 * chain proven here is the production chain — not a parallel hand-rolled
 * selection.
 *
 * Design rules (mirrors AAV-1316's cross-asset stub):
 * - Pure: no @playwright/test, no fetch. Unit-tested in
 *   src/test/crossReserveOffsetStub.test.ts.
 * - The base payload is never mutated (structuredClone).
 * - Anything that would degrade into a silent skip throws — this payload
 *   exists precisely to replace "always skipped" with "actually executed".
 * - The fixture's real Base WETH campaign window (ended 2026-10-14) is
 *   widened to 2026-01-01 → 2035-01-01 inside the fixture file, so the
 *   committed payload is not a time bomb. Field shapes stay real (ISO strings
 *   through the same parsing path) — only the dates are synthetic, like the
 *   constraint itself.
 *
 * Provenance: `e2e/fixtures/markets-cross-reserve-offset-base.json` is the
 * Base-pair subset (AaveV3Base WETH target + AaveV3Base USDC offset) of
 * `markets-cross-asset-pairing-base.json` (real staging capture, 2026-10-11),
 * with `merklSupplys[0].netPositionConstraint = { sourceSide: 'supply',
 * offsetReserveIds: [USDC] }` and the campaign window raised. The Celo WETH
 * reserve of the source fixture is dropped: its real self-loop window
 * expires 2026-12-10 and would be a second time bomb.
 */

export const CROSS_RESERVE_OFFSET_FIXTURE_URL = new URL(
  './fixtures/markets-cross-reserve-offset-base.json',
  import.meta.url,
);

/** AaveV3Base WETH — the target carrying the injected constraint. */
export const CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID =
  '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x4200000000000000000000000000000000000006';

/** AaveV3Base USDC — the offset reserve the runner supplies on and borrows from. */
export const CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID =
  '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

export interface CrossReserveOffsetStubPayload {
  snapshot: Record<string, unknown>;
  reserves: DiscoveryReserve[];
}

export interface CrossReserveOffsetStub {
  payload: CrossReserveOffsetStubPayload;
  /** The single cross-reserve scenario the REAL gates select. */
  scenario: OffsetScenario;
}

function fail(message: string): never {
  throw new Error(`[AAV-1333 cross-reserve-offset stub] ${message}`);
}

function constraintOffsetIds(base: unknown): string[] | null {
  const reserves = (base as { reserves?: unknown } | null | undefined)?.reserves;
  if (!Array.isArray(reserves)) return null;
  const target = (reserves as DiscoveryReserve[]).find((r) => r.reserveId === CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID);
  const groups = target?.merklSupplys;
  if (!Array.isArray(groups) || groups.length === 0) return null;
  const constraint = (groups[0] as { netPositionConstraint?: { offsetReserveIds?: unknown } | null })
    .netPositionConstraint;
  const ids = constraint?.offsetReserveIds;
  return Array.isArray(ids) ? (ids as string[]) : null;
}

interface StubCampaignGroup {
  opportunityId?: string;
  netPositionConstraint?: unknown;
  breakdowns?: Array<{ campaignId?: string } & Record<string, unknown>>;
  [key: string]: unknown;
}

const NON_RESPONDING_SUFFIX = '-nonresponding';

/**
 * AAV-1395 — append a second, unconstrained group cloned from the fixture's
 * real campaign. Equal APRs make the plan's `weight` exactly 0.5, so the
 * browser run exercises the dilution path end-to-end.
 */
function injectNonRespondingGroup(payload: CrossReserveOffsetStubPayload): void {
  const target = payload.reserves.find((r) => r.reserveId === CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID);
  const groups = target?.merklSupplys;
  if (!Array.isArray(groups) || groups.length === 0) {
    fail(`target ${CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID} carries no merklSupplys to clone`);
  }
  const clone = structuredClone(groups[0]) as StubCampaignGroup;
  delete clone.netPositionConstraint;
  if (typeof clone.opportunityId === 'string') {
    clone.opportunityId = `${clone.opportunityId}${NON_RESPONDING_SUFFIX}`;
  }
  clone.breakdowns = (clone.breakdowns ?? []).map((breakdown, index) => ({
    ...breakdown,
    campaignId: `${breakdown.campaignId ?? `campaign-${index}`}${NON_RESPONDING_SUFFIX}`,
  }));
  groups.push(clone);
}

/**
 * Validate the fixture's baked injection and let the real discovery gates select
 * the scenario. Throws when the payload would silently skip — that is a
 * fixture bug this spec must surface, not tolerate.
 */
export function buildCrossReserveOffsetStub(base: unknown): CrossReserveOffsetStub {
  if (base === null || typeof base !== 'object') fail('base payload must be an object with a reserves array');
  const reserves = (base as { reserves?: unknown }).reserves;
  if (!Array.isArray(reserves) || reserves.length === 0) {
    fail('base payload must carry a non-empty reserves array (a stub built from this would silently skip)');
  }
  const ids = constraintOffsetIds(base);
  if (!ids) fail(`target ${CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID} carries no netPositionConstraint in the fixture`);
  if (!ids.includes(CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID)) {
    fail('the fixture constraint does not point at the documented Base USDC offset reserve');
  }

  const payload = structuredClone(base) as CrossReserveOffsetStubPayload;
  // AAV-1395: second injection — a non-responding group halves the weight.
  injectNonRespondingGroup(payload);

  // The REAL gates select the scenario — a stub discovery excludes is a
  // fixture/injection bug and must fail loudly, not skip.
  const scenarios = discoverOffsetScenarios(payload.reserves, new Date().toISOString());
  const crossScenarios = scenarios.filter((s) => s.type === 'cross-reserve');
  if (crossScenarios.length !== 1) {
    fail(
      `discovery selected ${crossScenarios.length} cross-reserve scenarios (expected exactly 1) — the fixture ` +
        'payload no longer passes the AAV-1280/AAV-1318/AAV-1333 gates (rooms? LTV? campaign window? cap?)',
    );
  }
  const scenario = crossScenarios[0];
  if (scenario.targetReserveId !== CROSS_RESERVE_OFFSET_TARGET_RESERVE_ID) {
    fail(`discovered target ${scenario.targetReserveId} is not the documented Base WETH reserve`);
  }
  if (scenario.offsetReserveId !== CROSS_RESERVE_OFFSET_OFFSET_RESERVE_ID) {
    fail(`discovered offset ${scenario.offsetReserveId} is not the documented Base USDC reserve`);
  }
  // The cloned group must dilute the plan (weight 0.5 → rung 2 = 0.5 × 0.5).
  // If it does not, the clone was dropped or the fixture gained a constraint and
  // this stub silently stopped covering the multi-group path.
  const dilutedRung = scenario.plan.steps[1]?.expectedDecreaseRatio ?? Number.NaN;
  if (Math.abs(dilutedRung - 0.25) > 1e-9) {
    fail(`the injected non-responding group did not dilute the plan (rung 2 ratio ${dilutedRung}, expected 0.25)`);
  }

  return { payload, scenario };
}
