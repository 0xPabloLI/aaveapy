/**
 * AAV-1316 — synthetic crossAssetPairing stub builder for
 * e2e/portfolio-cross-asset-pairing.spec.ts.
 *
 * `crossAssetPairing` (Merkl min(1,2) campaigns) has never appeared in real
 * staging data, so the pairing spec has always skipped. This module turns a
 * pristine real `/markets` fixture into a stub payload with ONE injected
 * pairing, then re-runs the REAL discovery gates
 * (`discoverCrossAssetPairingScenarios`) to select the scenario — the same
 * gates the live path uses, so the stub variant proves the runner chain, not
 * a parallel hand-rolled selection.
 *
 * Design rules (docs/specs/aav-1316-cross-asset-pairing-synthetic-payload.md):
 * - Pure functions only: no @playwright/test, no fetch. Unit-tested in
 *   src/test/crossAssetPairingStub.test.ts.
 * - The base payload is never mutated (structuredClone).
 * - Anything that would degrade into a silent skip throws: this spec exists
 *   to replace "always skipped" with "actually executed".
 * - The real campaign window in the fixture expires; `campaignWindow`
 *   overrides the injected group's breakdown windows so a committed fixture
 *   is not a time bomb. Field SHAPES stay real (ISO strings through the same
 *   parsing path) — only the two date values are synthetic, like the pairing
 *   itself.
 */

import { discoverCrossAssetPairingScenarios, type CrossAssetScenario, type DiscoveryReserve } from './reserveDiscovery';

/** Wire shape of a Merkl min(1,2) cross-asset pairing constraint. */
export interface StubCrossAssetPairing {
  sourceSide: 'supply' | 'borrow';
  pairedReserveId: string;
  pairedSide: 'supply' | 'borrow';
  discountFactor: number;
}

export interface CrossAssetPairingInjection {
  /** Reserve whose `merklSupplys[groupIndex]` receives the synthetic pairing. */
  sourceReserveId: string;
  groupIndex: number;
  pairing: StubCrossAssetPairing;
  /**
   * Deterministic campaign window written into every breakdown of the
   * injected group. Omit only when the fixture's real window is guaranteed
   * open for the lifetime of the test suite (it is not, for the committed
   * fixture).
   */
  campaignWindow?: { startedAt: string; endedAt: string };
}

export interface CrossAssetPairingStubPayload {
  snapshot: Record<string, unknown>;
  reserves: DiscoveryReserve[];
}

export interface CrossAssetPairingStub {
  payload: CrossAssetPairingStubPayload;
  /** Scenarios the REAL discovery gates select on the injected payload. */
  scenarios: CrossAssetScenario[];
}

/**
 * Pristine real staging payload (captured 2026-10-10 ~22:40 UTC+8; fixture
 * `snapshot.lastUpdated` is the same capture in UTC), trimmed to the two
 * AaveV3Base reserves the stub variant
 * exercises: WETH (source, carries the one merklSupplys group) and USDC
 * (paired). Field shapes are untouched — the browser-side app validates this
 * payload with MarketsResponseSchema exactly like a live response (SY5b).
 */
export const CROSS_ASSET_PAIRING_FIXTURE_URL = new URL(
  './fixtures/markets-cross-asset-pairing-base.json',
  import.meta.url,
);

/**
 * The committed injection: supply × supply keeps the runner on its simplest
 * path (no LTV funding), the injected group is the source reserve's ONLY
 * computable supply-side incentive (baseline = 0 provable), and the pair is
 * same-market / distinct-symbol (fill helpers locate inputs by symbol).
 * discountFactor 0.5 spaces the 500 / 2000 / 5000 ladder into three distinct
 * eligible amounts (250 / 1000 / 1000).
 */
export const AAV1316_STUB_INJECTION: CrossAssetPairingInjection = {
  sourceReserveId: '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x4200000000000000000000000000000000000006',
  groupIndex: 0,
  pairing: {
    sourceSide: 'supply',
    pairedReserveId: '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    pairedSide: 'supply',
    discountFactor: 0.5,
  },
  campaignWindow: { startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2035-01-01T00:00:00.000Z' },
};

function fail(message: string): never {
  throw new Error(`[AAV-1316 cross-asset-pairing stub] ${message}`);
}

export function buildCrossAssetPairingStub(
  base: unknown,
  injection: CrossAssetPairingInjection,
): CrossAssetPairingStub {
  if (base === null || typeof base !== 'object') {
    fail('base payload must be an object with a reserves array');
  }
  const reserves = (base as { reserves?: unknown }).reserves;
  if (!Array.isArray(reserves) || reserves.length === 0) {
    fail('base payload must carry a non-empty reserves array (got none — a stub built from this would silently skip)');
  }

  const payload = structuredClone(base) as CrossAssetPairingStubPayload;

  const source = payload.reserves.find((r) => r.reserveId === injection.sourceReserveId);
  if (!source) fail(`source reserve ${injection.sourceReserveId} not found in base payload`);
  const groups = source.merklSupplys;
  if (!Array.isArray(groups) || !(injection.groupIndex in groups)) {
    fail(`source reserve has no merklSupplys[${injection.groupIndex}] to inject into`);
  }

  const group = groups[injection.groupIndex] as Record<string, unknown>;
  if (group.crossAssetPairing != null) {
    fail('target group already carries a crossAssetPairing — refusing to overwrite real data');
  }
  group.crossAssetPairing = { ...injection.pairing };

  if (injection.campaignWindow) {
    const breakdowns = group.breakdowns;
    if (!Array.isArray(breakdowns) || breakdowns.length === 0) {
      fail('injected group has no breakdowns to normalize the campaign window on');
    }
    for (const b of breakdowns as Record<string, unknown>[]) {
      b.campaignStartedAt = injection.campaignWindow.startedAt;
      b.campaignEndedAt = injection.campaignWindow.endedAt;
    }
  }

  // The REAL gates select the scenario — a stub that discovery excludes is a
  // fixture/injection bug and must fail loudly, not skip.
  const nowIso = new Date().toISOString();
  const scenarios = discoverCrossAssetPairingScenarios(payload.reserves, nowIso).filter(
    (s) => s.sourceReserveId === injection.sourceReserveId && s.sourceSide === injection.pairing.sourceSide,
  );
  if (scenarios.length === 0) {
    fail(
      'discovery selected zero scenarios on the injected payload — the injection does not pass the ' +
        'AAV-1308 gates (paired id mismatch? rooms? LTV?) — refusing to emit a stub that would skip',
    );
  }

  return { payload, scenarios };
}
