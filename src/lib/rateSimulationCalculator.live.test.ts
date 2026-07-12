/**
 * Live API incentive consistency tests.
 *
 * Fetches real /markets data from localhost:3001 (preferred) or staging API,
 * then runs buildRateSimulationResult on every reserve with incentives to verify:
 *
 * 1. currentIncentive = Protocol + Merit + Merkl + Brevis per-source sum (Golden Rule §2)
 * 2. afterIncentive = same per-source sum when inputs are provided (Golden Rule §2)
 * 3. currentIncentive does NOT change when simulation inputs change (Golden Rule §1)
 * 4. Portfolio currentIncentive does NOT change when delta crosses cap threshold (AAV-1120)
 *
 * Gated behind RUN_LIVE_TESTS=true so `npm test` stays deterministic.
 *
 * Run explicitly:
 *   npm run test:live
 *   # or with local backend:
 *   LIVE_TEST_API_BASE=http://localhost:3001/api RUN_LIVE_TESTS=true npx vitest run src/lib/rateSimulationCalculator.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { buildRateSimulationResult } from './rateSimulationCalculator';
import { hasRateCalcFields } from './interestRateCalculator';
import { resolveLiveApiBase } from './apiSchemas.live.helpers';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateCalcInput } from './interestRateCalculator';

const API_BASE = resolveLiveApiBase();
const TIMEOUT = 30_000;

/** Tolerance for floating-point incentive comparisons (0.001% = 1e-5). */
const INCENTIVE_TOLERANCE = 1e-5;

/** Only test reserves that have at least one incentive source. */
function hasIncentives(reserve: ReserveWithSpread): boolean {
  return (
    (reserve.supplyIncentives?.length ?? 0) > 0 ||
    (reserve.borrowIncentives?.length ?? 0) > 0 ||
    (reserve.meritSupplys?.length ?? 0) > 0 ||
    (reserve.meritBorrows?.length ?? 0) > 0 ||
    (reserve.merklSupplys?.length ?? 0) > 0 ||
    (reserve.merklBorrows?.length ?? 0) > 0 ||
    (reserve.brevisSupplys?.length ?? 0) > 0 ||
    (reserve.brevisBorrows?.length ?? 0) > 0
  );
}

async function fetchReserves(): Promise<ReserveWithSpread[]> {
  const url = `${API_BASE}/markets`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} returned ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const reserves: ReserveWithSpread[] = json.reserves ?? json;
  if (!Array.isArray(reserves) || reserves.length === 0) {
    throw new Error('API returned no reserves');
  }
  return reserves;
}

function buildRateInput(reserve: ReserveWithSpread): RateCalcInput | null {
  return hasRateCalcFields(reserve) ? { ...reserve } : null;
}

function buildBaseParams(reserve: ReserveWithSpread) {
  return {
    isApy: true,
    whitelistMerklCampaignIds: undefined,
    tydroPointToUsdRate: 1,
    tokenPrice: reserve.tokenPrice,
    supplyInput: '',
    borrowInput: '',
    forecastStates: {} as Record<string, never>,
  };
}

describe.skipIf(!process.env.RUN_LIVE_TESTS)('Live API: incentive consistency on real data', () => {
  let reserves: ReserveWithSpread[];

  it(
    'fetches reserves from API',
    async () => {
      reserves = await fetchReserves();
      expect(reserves.length).toBeGreaterThan(0);
      const withIncentives = reserves.filter(hasIncentives);
      expect(withIncentives.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'Golden Rule §2: currentIncentive = Protocol + Merit + Merkl + Brevis (supply side)',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);
      let checked = 0;

      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        const result = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...buildBaseParams(reserve),
        });

        const protocolCurrent = result.supply.sources.protocol?.current ?? 0;
        const meritCurrent = result.supply.sources.merit?.current ?? 0;
        const merklCurrent = result.supply.sources.merkl?.current ?? 0;
        const brevisCurrent = result.supply.sources.brevis?.current ?? 0;
        const perSourceSum = protocolCurrent + meritCurrent + merklCurrent + brevisCurrent;

        expect(perSourceSum).toBeCloseTo(
          result.supply.currentIncentive,
          5,
        );
        checked++;
      }

      // Ensure we tested at least one reserve
      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'Golden Rule §2: currentIncentive = Protocol + Merit + Merkl + Brevis (borrow side)',
    async () => {
      reserves ??= await fetchReserves();
      const withBorrowIncentives = reserves.filter(
        r =>
          (r.borrowIncentives?.length ?? 0) > 0 ||
          (r.meritBorrows?.length ?? 0) > 0 ||
          (r.merklBorrows?.length ?? 0) > 0 ||
          (r.brevisBorrows?.length ?? 0) > 0,
      );

      let checked = 0;
      for (const reserve of withBorrowIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        const result = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...buildBaseParams(reserve),
        });

        const protocolCurrent = result.borrow.sources.protocol?.current ?? 0;
        const meritCurrent = result.borrow.sources.merit?.current ?? 0;
        const merklCurrent = result.borrow.sources.merkl?.current ?? 0;
        const brevisCurrent = result.borrow.sources.brevis?.current ?? 0;
        const perSourceSum = protocolCurrent + meritCurrent + merklCurrent + brevisCurrent;

        expect(perSourceSum).toBeCloseTo(
          result.borrow.currentIncentive,
          5,
        );
        checked++;
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'Golden Rule §2: afterIncentive = per-source sum (supply side, with simulation input)',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);

      let checked = 0;
      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        if (!reserveRateInput) continue;

        const result = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...buildBaseParams(reserve),
          supplyInput: '1000',
          inputMode: 'usd',
        });

        if (result.supply.afterIncentive === null) continue;

        const protocolAfter = result.supply.sources.protocol?.after ?? 0;
        const meritAfter = result.supply.sources.merit?.after ?? 0;
        const merklAfter = result.supply.sources.merkl?.after ?? 0;
        const brevisAfter = result.supply.sources.brevis?.after ?? 0;
        const perSourceSum = protocolAfter + meritAfter + merklAfter + brevisAfter;

        expect(perSourceSum).toBeCloseTo(
          result.supply.afterIncentive,
          5,
        );
        checked++;
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'Golden Rule §1: currentIncentive does NOT change with simulation input (Shared Scenario)',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);

      let checked = 0;
      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        if (!reserveRateInput) continue;

        const baseParams = buildBaseParams(reserve);

        // No input
        const r1 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: '0',
          inputMode: 'usd',
        });

        // With supply input
        const r2 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '5000',
          borrowInput: '0',
          inputMode: 'usd',
        });

        // With borrow input
        const r3 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: '5000',
          inputMode: 'usd',
        });

        // currentIncentive must be identical in all three scenarios (Shared Scenario = no wallet)
        expect(r2.supply.currentIncentive).toBeCloseTo(
          r1.supply.currentIncentive,
          6,
        );
        expect(r3.supply.currentIncentive).toBeCloseTo(
          r1.supply.currentIncentive,
          6,
        );
        expect(r2.borrow.currentIncentive).toBeCloseTo(
          r1.borrow.currentIncentive,
          6,
        );
        expect(r3.borrow.currentIncentive).toBeCloseTo(
          r1.borrow.currentIncentive,
          6,
        );

        // currentTotal must also be invariant
        if (r1.supply.currentTotal !== null && r2.supply.currentTotal !== null) {
          expect(r2.supply.currentTotal).toBeCloseTo(r1.supply.currentTotal, 6);
        }
        if (r1.borrow.currentTotal !== null && r3.borrow.currentTotal !== null) {
          expect(r3.borrow.currentTotal).toBeCloseTo(r1.borrow.currentTotal, 6);
        }

        checked++;
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'Golden Rule §1: currentIncentive does NOT change with simulation input (Portfolio mode)',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);

      let checked = 0;
      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        if (!reserveRateInput) continue;

        const baseParams = buildBaseParams(reserve);
        // Simulate a wallet with $10000 supply, $5000 borrow
        const walletSupply = 10000;
        const walletBorrow = 5000;

        // No delta
        const r1 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: '0',
          inputMode: 'usd',
          totalSupplyUsd: walletSupply,
          totalBorrowUsd: walletBorrow,
        });

        // With supply delta
        const r2 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '2000',
          borrowInput: '0',
          inputMode: 'usd',
          totalSupplyUsd: walletSupply + 2000,
          totalBorrowUsd: walletBorrow,
        });

        // With borrow delta
        const r3 = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: '2000',
          inputMode: 'usd',
          totalSupplyUsd: walletSupply,
          totalBorrowUsd: walletBorrow + 2000,
        });

        // currentIncentive must be identical — wallet hasn't changed
        expect(r2.supply.currentIncentive).toBeCloseTo(
          r1.supply.currentIncentive,
          6,
        );
        expect(r3.supply.currentIncentive).toBeCloseTo(
          r1.supply.currentIncentive,
          6,
        );
        expect(r2.borrow.currentIncentive).toBeCloseTo(
          r1.borrow.currentIncentive,
          6,
        );
        expect(r3.borrow.currentIncentive).toBeCloseTo(
          r1.borrow.currentIncentive,
          6,
        );

        checked++;
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'AAV-1120: Portfolio currentIncentive same whether delta is under or over cap',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);

      let checked = 0;
      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        if (!reserveRateInput) continue;

        const baseParams = buildBaseParams(reserve);
        const walletSupply = 50000;
        const walletBorrow = 30000;

        // Small delta (likely under cap)
        const smallDelta = 100;
        const rSmall = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: String(smallDelta),
          inputMode: 'usd',
          totalSupplyUsd: walletSupply,
          totalBorrowUsd: walletBorrow + smallDelta,
        });

        // Large delta (may exceed cap)
        const largeDelta = 100000;
        const rLarge = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...baseParams,
          supplyInput: '0',
          borrowInput: String(largeDelta),
          inputMode: 'usd',
          totalSupplyUsd: walletSupply,
          totalBorrowUsd: walletBorrow + largeDelta,
        });

        // currentIncentive must be the same — wallet borrow is $30000 in both cases
        // With AAV-1120 fix: walletBorrowUsd = totalBorrowUsd - rawBorrowInputUsd
        // Both give walletBorrowUsd = $30000 regardless of capping
        expect(rLarge.borrow.currentIncentive).toBeCloseTo(
          rSmall.borrow.currentIncentive,
          6,
        );

        checked++;
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'currentTotal = currentNative + currentIncentive (supply side)',
    async () => {
      reserves ??= await fetchReserves();
      const withIncentives = reserves.filter(hasIncentives);

      let checked = 0;
      for (const reserve of withIncentives) {
        const reserveRateInput = buildRateInput(reserve);
        const result = buildRateSimulationResult({
          reserve,
          reserveRateInput,
          ...buildBaseParams(reserve),
        });

        if (result.supply.currentTotal !== null && result.supply.currentNative !== null) {
          const expected = result.supply.currentNative + result.supply.currentIncentive;
          expect(expected).toBeCloseTo(result.supply.currentTotal, 6);
          checked++;
        }
      }

      expect(checked).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});
