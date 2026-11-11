/**
 * AAV-1316 — unit tests for the cross-asset-pairing stub builder.
 *
 * The builder turns a pristine real-staging fixture into a synthetic-payload
 * stub: injects one `crossAssetPairing` into a chosen group, normalizes the
 * campaign window (real windows expire — a committed fixture must not be a
 * time bomb), and re-runs the REAL discovery gates to select the scenario.
 * Anything that would end in a silent skip (missing reserves, unmatched ids,
 * zero discovered scenarios) must throw — the stub variant's whole purpose is
 * to replace "always skipped" with "actually executed".
 *
 * Scenario matrix: docs/specs/aav-1316-cross-asset-pairing-synthetic-payload.md (SY1–SY5).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AAV1316_STUB_INJECTION,
  CROSS_ASSET_PAIRING_FIXTURE_URL,
  buildCrossAssetPairingStub,
  type CrossAssetPairingInjection,
} from '../../e2e/crossAssetPairingStub';
import type { DiscoveryReserve } from '../../e2e/reserveDiscovery';

function loadFixture(): unknown {
  return JSON.parse(readFileSync(CROSS_ASSET_PAIRING_FIXTURE_URL, 'utf8')) as unknown;
}

// Literal ids + expected scenario shape are pinned ON PURPOSE: SY1's toEqual
// and these literals lock the wire contract (SY5) even if AAV1316_STUB_INJECTION
// is ever re-pointed at a different fixture pair.
const SOURCE_ID = '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x4200000000000000000000000000000000000006';
const PAIRED_ID = '8453:0xa238dd80c259a72e81d7e4664a9801593f98d1c5:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const INJECTION: CrossAssetPairingInjection & {
  campaignWindow: { startedAt: string; endedAt: string };
} = {
  sourceReserveId: SOURCE_ID,
  groupIndex: 0,
  pairing: { sourceSide: 'supply', pairedReserveId: PAIRED_ID, pairedSide: 'supply', discountFactor: 0.5 },
  campaignWindow: { startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2035-01-01T00:00:00.000Z' },
};

describe('AAV-1316 buildCrossAssetPairingStub', () => {
  // SY1 — injection + real discovery selects exactly one scenario
  it('SY1: yields exactly one discovery scenario with expected fields', () => {
    const { scenarios } = buildCrossAssetPairingStub(loadFixture(), INJECTION);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toEqual({
      sourceSymbol: 'WETH',
      sourceMarketLabel: 'Base',
      sourceReserveId: SOURCE_ID,
      sourceSide: 'supply',
      pairedSymbol: 'USDC',
      pairedMarketLabel: 'Base',
      pairedReserveId: PAIRED_ID,
      pairedSide: 'supply',
      discountFactor: 0.5,
      chainName: 'Base',
      apr: expect.any(Number),
    });
    expect(scenarios[0].apr).toBeGreaterThan(0);
  });

  it('SY1b: ships the committed injection aligned with the fixture reserves', () => {
    const reserves = (loadFixture() as { reserves: DiscoveryReserve[] }).reserves;
    const ids = reserves.map((r) => r.reserveId);
    expect(ids).toContain(AAV1316_STUB_INJECTION.sourceReserveId);
    expect(ids).toContain(AAV1316_STUB_INJECTION.pairing.pairedReserveId);
    expect(buildCrossAssetPairingStub(loadFixture(), AAV1316_STUB_INJECTION).scenarios).toHaveLength(1);
  });

  // SY2 — builder must not mutate the base payload (fixture is reused per worker)
  it('SY2: does not mutate the base payload', () => {
    const base = loadFixture();
    const before = JSON.stringify(base);
    buildCrossAssetPairingStub(base, INJECTION);
    expect(JSON.stringify(base)).toBe(before);
    const reserves = (base as { reserves: DiscoveryReserve[] }).reserves;
    const source = reserves.find((r) => r.reserveId === SOURCE_ID);
    const group = (source?.merklSupplys as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
    expect(group).toBeDefined();
    expect(group?.crossAssetPairing).toBeUndefined();
    // Real (unmodified) campaign window is preserved on the base fixture.
    const breakdown = (group?.breakdowns as Array<Record<string, unknown>>)?.[0];
    expect(breakdown?.campaignEndedAt).not.toBe(INJECTION.campaignWindow.endedAt);
  });

  // SY3 — invalid base payloads throw instead of silently skipping
  it('SY3: throws on non-object / missing / empty reserves', () => {
    expect(() => buildCrossAssetPairingStub(null, INJECTION)).toThrow(/reserves/i);
    expect(() => buildCrossAssetPairingStub({}, INJECTION)).toThrow(/reserves/i);
    expect(() => buildCrossAssetPairingStub({ reserves: [] }, INJECTION)).toThrow(/reserves/i);
  });

  // SY4 — any mismatch that would produce zero scenarios must throw
  it('SY4: throws when paired reserve is absent from the payload', () => {
    const broken: CrossAssetPairingInjection = {
      ...INJECTION,
      pairing: { ...INJECTION.pairing, pairedReserveId: '999:not-a-reserve' },
    };
    expect(() => buildCrossAssetPairingStub(loadFixture(), broken)).toThrow(/scenario/i);
  });

  it('SY4b: throws when the injected window fails the discovery gates (expired campaign)', () => {
    // Deterministic negative: a long-past window can never pass
    // isComputableMerklCampaign, so discovery selects zero scenarios and the
    // builder must throw — proving the window gate actually bites instead of
    // silently emitting an empty stub (the original failure mode of this spec).
    const expired: CrossAssetPairingInjection = {
      ...INJECTION,
      campaignWindow: { startedAt: '2020-01-01T00:00:00.000Z', endedAt: '2021-01-01T00:00:00.000Z' },
    };
    expect(() => buildCrossAssetPairingStub(loadFixture(), expired)).toThrow(/scenario/i);
  });

  // SY5 — injected wire shape matches the CrossAssetPairing contract exactly
  it('SY5: injected crossAssetPairing carries exactly the contract fields', () => {
    const { payload } = buildCrossAssetPairingStub(loadFixture(), INJECTION);
    const source = payload.reserves.find((r) => r.reserveId === SOURCE_ID);
    const group = (source?.merklSupplys as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
    expect(group?.crossAssetPairing).toEqual({
      sourceSide: 'supply',
      pairedReserveId: PAIRED_ID,
      pairedSide: 'supply',
      discountFactor: 0.5,
    });
    // Window override applied to the injected group's breakdowns only.
    const breakdowns = (group?.breakdowns as Array<Record<string, unknown>>) ?? [];
    expect(breakdowns.length).toBeGreaterThan(0);
    for (const b of breakdowns) {
      expect(b.campaignStartedAt).toBe(INJECTION.campaignWindow.startedAt);
      expect(b.campaignEndedAt).toBe(INJECTION.campaignWindow.endedAt);
    }
    // Other reserves' groups untouched.
    const paired = payload.reserves.find((r) => r.reserveId === PAIRED_ID);
    expect(paired?.merklSupplys).toBeUndefined();
  });

  it('SY5b: stub payload passes the same gates the app validates /markets with', async () => {
    // The browser-side app runs MarketsResponseSchema.safeParse on /markets;
    // a fixture that fails it would render the error state, not the table.
    const { MarketsResponseSchema } = await import('../shared/market-contract/schemas');
    const { payload } = buildCrossAssetPairingStub(loadFixture(), INJECTION);
    expect(() => MarketsResponseSchema.parse(payload)).not.toThrow();
  });
});
