/**
 * Pure discovery logic for e2e reserve selection (AAV-1299).
 *
 * Zero-dependency module (no @playwright/test import) so it can be unit
 * tested under vitest (vitest excludes `e2e/**` from test discovery but can
 * still import files from there).
 *
 * Problem it solves: `findIncentiveReserve()` previously only checked
 * `merklSupplys.length > 0` (plus the retired Merit arrays). Campaigns with
 * APR=0, expired windows, AMOUNT variants (APR is token-amount semantics, not
 * percent — AAV-1275), or TARGET_TOTAL_APR with 0 apr render incentive cells
 * as '—' with no recovery — making `not.toContainText('—')` assertions fail
 * after their full timeout (flaky e2e).
 *
 * A campaign is "computable" only when the UI can render a numeric percent
 * for it, mirroring `getMerklBreakdownApr` (src/lib/merklForecast.ts):
 * 1. `campaignApr > 0`, or points-based (`pointsPerThousandUsd > 0`)
 * 2. started < now < ended with BOTH boundaries present (mirrors
 *    `isCampaignActive` with allowOpenEnd=false — AAV-1280)
 * 3. campaignType is not an AMOUNT variant
 * 4. not whitelist-only (e2e never opts in — AAV-1280)
 */

// ─── Types ───────────────────────────────────────────────────────────

/** Loose shape of a raw `/api/markets` reserve as consumed by discovery. */
export interface DiscoveryReserve extends Record<string, unknown> {
  reserveId?: string;
  tokenSymbol?: string;
  marketName?: string;
  chainName?: string;
  chainId?: number;
  ltv?: number;
}

/** Minimal reserve identity returned to specs (mirrors TestReserve). */
export interface PickedReserve {
  symbol: string;
  marketLabel: string;
  reserveId: string;
  chainName: string;
  marketName: string;
  ltv: number;
}

export interface MerklBreakdown {
  campaignApr?: number;
  campaignStartedAt?: string;
  campaignEndedAt?: string;
  campaignType?: string;
  pointsPerThousandUsd?: number;
  whitelistOnly?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

/**
 * AMOUNT-variant Merkl campaign types (ForecastCampaignTypeLite enum).
 * Their APR value is a token amount (per day/period), NOT percent points —
 * the UI cannot render them as a % (AAV-1275), so they must be excluded.
 */
export const AMOUNT_VARIANT_CAMPAIGN_TYPES: readonly string[] = [
  'FIX_REWARD_AMOUNT_PER_LIQUIDITY_VALUE',
  'FIX_REWARD_AMOUNT_PER_LIQUIDITY_AMOUNT',
  'MAX_REWARD_VALUE_PER_LIQUIDITY_AMOUNT',
];

/**
 * Minimum USD of position room a reserve must offer for the cross-asset-pairing
 * runner to use it: the largest single amount that runner types on one reserve
 * (the 500 → 2000 → 5000 paired ladder in portfolio-cross-asset-pairing.spec.ts).
 * Room below this is not merely "small" — it clamps every ladder step onto the
 * same value, so the relative assertions go false-green (AAV-1308).
 * Keep in sync with the amounts typed by that runner.
 */
export const PAIRING_SIM_MIN_ROOM_USD = 5_000;

/** USD the runner supplies to create borrowing power before a typed borrow. */
const PAIRING_SIM_FUNDING_USD = 100_000;

/** Reserve fields holding a native-unit amount that the room getters convert. */
type NativeRoomField = 'suppliable' | 'supplyCap' | 'supplied' | 'borrowable' | 'borrowCap' | 'borrowed';

// ─── Campaign predicates ─────────────────────────────────────────────

const parseTime = (iso: string | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * Mirrors `parseCampaignBoundaryMs` (src/lib/campaignGroups.ts): date-only
 * boundaries normalize to start-of-day (start) / end-of-day (end), so an
 * end date of `2026-10-01` stays renderable through that whole day.
 */
const parseBoundary = (value: string | undefined, boundary: 'start' | 'end'): number | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const t = Date.parse(normalized);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};

const parseApr = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Whether a single Merkl breakdown can produce a numeric incentive percent
 * in the UI at time `nowIso` (mirrors getMerklBreakdownApr + forecast gating).
 *
 * AAV-1280: the gate chain must mirror the UI's render gates exactly
 * (sumMerklIncentiveApr in src/lib/incentiveAggregation.ts):
 * 1. `isCampaignActive(start, end, now, allowOpenEnd=false)` — a breakdown
 *    missing either boundary is NOT counted by the UI (Merkl never open-end),
 *    so discovery must not select it either.
 * 2. whitelist-only campaigns are excluded unless the user opts in — e2e
 *    never opts in, so they always render '—'.
 * 3. AMOUNT variants are a test-side conservative exclusion (their APR is a
 *    token amount, not percent — AAV-1275).
 */
export function isComputableMerklCampaign(b: MerklBreakdown, nowIso: string): boolean {
  if (b.whitelistOnly) return false;
  const now = parseTime(nowIso);
  const started = parseBoundary(b.campaignStartedAt, 'start');
  if (started === null || (now != null && started > now)) return false;
  const ended = parseBoundary(b.campaignEndedAt, 'end');
  if (ended === null || (now != null && ended < now)) return false;
  if (b.campaignType && AMOUNT_VARIANT_CAMPAIGN_TYPES.includes(b.campaignType)) return false;
  const apr = parseApr(b.campaignApr);
  if (apr > 0) return true;
  // APR=0 is only renderable for points-based campaigns (Tydro formula).
  const points = parseApr(b.pointsPerThousandUsd);
  return points > 0;
}

// ─── Reserve predicates ──────────────────────────────────────────────

/** The Merkl opportunity-group array for a rate side (AAV-1308). */
function merklGroupsForSide(r: DiscoveryReserve, side: 'supply' | 'borrow'): unknown[] {
  const groups = side === 'supply' ? r.merklSupplys : r.merklBorrows;
  return Array.isArray(groups) ? groups : [];
}

function breakdownsOfGroup(group: unknown): MerklBreakdown[] {
  const breakdowns = (group as { breakdowns?: unknown })?.breakdowns;
  return Array.isArray(breakdowns) ? (breakdowns as MerklBreakdown[]) : [];
}

function merklBreakdownsForSide(r: DiscoveryReserve, side: 'supply' | 'borrow'): MerklBreakdown[] {
  return merklGroupsForSide(r, side).flatMap(breakdownsOfGroup);
}

/** Sum of the breakdown APRs the UI can actually render (percent points). */
function computableAprPercent(breakdowns: MerklBreakdown[], nowIso: string): number {
  return breakdowns
    .filter((b) => isComputableMerklCampaign(b, nowIso))
    .reduce((acc, b) => acc + parseApr(b.campaignApr), 0);
}

/**
 * Whether the reserve has at least one supply-side Merkl campaign the UI can
 * compute a numeric percent for. Merit arrays are deliberately NOT considered
 * (Merit was fully retired — AAV-1289).
 */
export function hasComputableSupplyIncentive(r: DiscoveryReserve, nowIso: string): boolean {
  return merklBreakdownsForSide(r, 'supply').some((b) => isComputableMerklCampaign(b, nowIso));
}

/**
 * Native supply APY plus the APR of every computable supply campaign —
 * used to rank candidates so the discovered reserve yields the most stable
 * numeric values.
 */
export function computeSupplyNetApyPercent(r: DiscoveryReserve, nowIso: string): number {
  return parseApr(r.supplyApy) + computableAprPercent(merklBreakdownsForSide(r, 'supply'), nowIso);
}

function isUsableReserve(r: DiscoveryReserve): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  const ltv = r.ltv;
  return typeof ltv === 'number' && ltv > 0;
}

/** Reserve lookup by canonical `reserveId` (shared by both discovery paths). */
function indexReservesById(reserves: DiscoveryReserve[]): Map<string, DiscoveryReserve> {
  const idMap = new Map<string, DiscoveryReserve>();
  for (const r of reserves) {
    if (typeof r.reserveId === 'string' && r.reserveId) idMap.set(r.reserveId, r);
  }
  return idMap;
}

/**
 * Whether a reserve carries every identity field the runner types into a
 * locator. `/markets` JSON is consumed unvalidated here, so a reserve missing
 * one must be skipped rather than thrown at module load — a throw fails the
 * whole spec file where a skip only loses a scenario.
 */
function hasRunnerIdentity(r: DiscoveryReserve): boolean {
  return (
    typeof r.reserveId === 'string' &&
    r.reserveId.length > 0 &&
    typeof r.tokenSymbol === 'string' &&
    r.tokenSymbol.length > 0 &&
    typeof r.marketName === 'string' &&
    r.marketName.length > 0 &&
    typeof r.chainName === 'string' &&
    r.chainName.length > 0
  );
}

// ─── Position room (mirrors the app's marketMetrics / rateSimulation fallback) ──

/** Native-unit field of a reserve converted to USD, or null when unusable. */
function nativeFieldToUsd(r: DiscoveryReserve, field: NativeRoomField): number | null {
  const price = r.tokenPrice as number | undefined;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const raw = r[field];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  const decimals = (r.decimals as number | undefined) ?? 18;
  return (value / Math.pow(10, decimals)) * price;
}

/**
 * Cap-minus-used fallback. A cap of 0 means UNLIMITED in Aave, so the app
 * guards this branch with `capUsd > 0` (rateSimulationCalculator.ts) and so do
 * we: without the guard a `borrowCap: '0'` reserve would read as "zero room".
 */
function capRemainingUsd(r: DiscoveryReserve, capField: NativeRoomField, usedField: NativeRoomField): number | null {
  const capUsd = nativeFieldToUsd(r, capField);
  const usedUsd = nativeFieldToUsd(r, usedField);
  if (capUsd === null || usedUsd === null || capUsd <= 0) return null;
  return Math.max(capUsd - usedUsd, 0);
}

/**
 * USD supply room — the constraint that clamps a manual supply to 0, rendering
 * every portfolio cell as '—'. Mirrors the `availableSupplyRoomUsd` fallback
 * chain in rateSimulationCalculator.ts: `suppliable` preferred, else
 * `supplyCap − supplied` (only when a real cap is set).
 * Returns null when data is insufficient (treated as "don't exclude").
 */
export function getSupplyRoomUsd(r: DiscoveryReserve): number | null {
  return nativeFieldToUsd(r, 'suppliable') ?? capRemainingUsd(r, 'supplyCap', 'supplied');
}

/**
 * USD borrow room — the constraint that clamps a portfolio borrow to 0
 * (AAV-1308). Mirrors the data the app's `availableBorrowRoomUsd` reads from:
 * `borrowable` preferred, else `borrowCap − borrowed` (only when a real cap is
 * set). Deliberately narrower than the app formula: the app also min()s with
 * live liquidity plus the simulated supply, which depends on runner input that
 * isn't known at discovery time. Returns null when data is insufficient
 * (treated as "don't exclude", same contract as getSupplyRoomUsd).
 */
export function getBorrowRoomUsd(r: DiscoveryReserve): number | null {
  return nativeFieldToUsd(r, 'borrowable') ?? capRemainingUsd(r, 'borrowCap', 'borrowed');
}

/**
 * Whether a reserve can hold the positions the pairing runner types on it.
 *
 * The runner always supplies on both endpoints (`PAIRING_SIM_FUNDING_USD` where
 * a borrow follows, to create borrowing power) and borrows up to
 * `PAIRING_SIM_MIN_ROOM_USD` on the side that carries the position. A room
 * below that floor clamps the ladder onto one value — a false green (AAV-1308).
 * `min(supplyRoom, PAIRING_SIM_FUNDING_USD) × ltv` is the LTV-clamped borrowing
 * power (AAV-1250): a low-LTV reserve cannot fund the typed borrow.
 */
function usableForSimulatedPosition(r: DiscoveryReserve, side: 'supply' | 'borrow'): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (typeof r.ltv !== 'number' || r.ltv <= 0) return false;
  if (r.supplyDisabled === true) return false;
  const supplyRoom = getSupplyRoomUsd(r) ?? Number.POSITIVE_INFINITY;
  if (supplyRoom < PAIRING_SIM_MIN_ROOM_USD) return false;
  if (side === 'supply') return true;
  if (r.borrowDisabled === true) return false;
  if ((getBorrowRoomUsd(r) ?? Number.POSITIVE_INFINITY) < PAIRING_SIM_MIN_ROOM_USD) return false;
  return Math.min(supplyRoom, PAIRING_SIM_FUNDING_USD) * (r.ltv / 100) >= PAIRING_SIM_MIN_ROOM_USD;
}

// ─── Market label (mirrors getSubMarketLabel in src/lib/marketLabels.ts) ──

const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  AaveV3Ethereum: 'Core',
  AaveV3EthereumLido: 'Prime',
  AaveV3EthereumHorizon: 'Horizon RWA',
  AaveV3EthereumEtherFi: 'EtherFi',
};

/**
 * The label the Add button in the portfolio search renders for a market — the
 * runner matches on it, so a divergent copy selects the wrong row. Derived from
 * `marketName` alone (the app ignores `chainName` for API stability); a
 * parity test against `src/lib/marketLabels.ts` anchors this mirror.
 */
export function getMarketChipLabel(marketName: string, chainName?: string): string {
  void chainName;
  if (ETHEREUM_MARKET_NAMES[marketName]) return ETHEREUM_MARKET_NAMES[marketName];
  const stripped = marketName
    .replace(/^AaveV[34]/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return stripped || marketName;
}

// ─── Selection ───────────────────────────────────────────────────────

/**
 * Pick the best incentive reserve: usable, computable supply incentive,
 * preferring nonzero supply room, then highest net supply APR.
 * Returns null when no candidate qualifies (specs skip gracefully).
 */
export function pickIncentiveReserve(reserves: DiscoveryReserve[], nowIso: string): PickedReserve | null {
  const candidates = reserves.filter((r) => isUsableReserve(r) && hasComputableSupplyIncentive(r, nowIso));
  if (candidates.length === 0) return null;

  const withRoom = candidates.filter((r) => (getSupplyRoomUsd(r) ?? Number.POSITIVE_INFINITY) > 0);
  const pool = withRoom.length > 0 ? withRoom : candidates;
  const best = pool.reduce((a, b) =>
    computeSupplyNetApyPercent(b, nowIso) > computeSupplyNetApyPercent(a, nowIso) ? b : a,
  );

  return {
    symbol: best.tokenSymbol as string,
    marketLabel: getMarketChipLabel(best.marketName as string, best.chainName as string),
    reserveId: best.reserveId as string,
    chainName: best.chainName as string,
    marketName: best.marketName as string,
    ltv: best.ltv as number,
  };
}

// ─── Cross-reserve offset scenarios (AAV-1280) ───────────────────────

/** Loose shape of a Merkl opportunity group carrying a net-position constraint. */
interface OffsetOpportunityGroup {
  netPositionConstraint?: { offsetReserveIds?: string[] } | null;
  breakdowns?: unknown;
}

/** A portfolio cross-reserve/self-loop offset scenario to exercise in e2e. */
export interface OffsetScenario {
  type: 'cross-reserve' | 'self-loop';
  targetSymbol: string;
  targetMarketLabel: string;
  targetReserveId: string;
  /** Sum of computable breakdown APRs (percent points). */
  targetApr: number;
  chainName: string;
  offsetSymbol?: string;
  offsetMarketLabel?: string;
  offsetReserveId?: string;
}

function usableForOffsetPosition(r: DiscoveryReserve): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  if (typeof r.ltv !== 'number' || r.ltv <= 0) return false;
  if ((getSupplyRoomUsd(r) ?? Number.POSITIVE_INFINITY) <= 0) return false;
  return true;
}

/**
 * Discover cross-reserve / self-loop Merkl offset scenarios from /markets
 * reserves (ported from portfolio-cross-reserve-offset.spec.ts — AAV-1280).
 *
 * A group qualifies only when its COMPUTABLE breakdown APRs sum > 0: the
 * per-breakdown gate chain (active window with both boundaries, whitelist
 * opt-in, AMOUNT variants) mirrors the UI's render gates via
 * `isComputableMerklCampaign`, so discovery never selects a reserve the UI
 * renders as '—' (the AAV-1280 failure). Points-only groups stay excluded
 * (conservative: the proportional-offset assertions need percent APR).
 *
 * Cross-reserve scenarios additionally require the offset reserve to be
 * addable and borrowable (active, ltv > 0, borrow enabled, supply room).
 */
export function discoverOffsetScenarios(reserves: DiscoveryReserve[], nowIso: string): OffsetScenario[] {
  const idMap = indexReservesById(reserves);

  const scenarios: OffsetScenario[] = [];
  const seen = new Set<string>();

  for (const r of reserves) {
    if (typeof r.reserveId !== 'string' || !r.reserveId) continue;
    if (!usableForOffsetPosition(r)) continue;

    const groups = r.merklSupplys;
    if (!Array.isArray(groups)) continue;
    for (const g of groups as OffsetOpportunityGroup[]) {
      const offsets = g.netPositionConstraint?.offsetReserveIds;
      if (!Array.isArray(offsets)) continue;
      const nonSelf = offsets.filter((id) => id !== r.reserveId);
      const breakdowns = Array.isArray(g.breakdowns) ? (g.breakdowns as MerklBreakdown[]) : [];
      const apr = computableAprPercent(breakdowns, nowIso);
      if (apr <= 0) continue;

      const type = nonSelf.length > 0 ? 'cross-reserve' : 'self-loop';
      const dedupKey = `${r.reserveId}:${type}`;
      if (seen.has(dedupKey)) continue;

      const scenario: OffsetScenario = {
        type,
        targetSymbol: r.tokenSymbol as string,
        targetMarketLabel: getMarketChipLabel(r.marketName as string, r.chainName as string),
        targetReserveId: r.reserveId,
        targetApr: apr,
        chainName: r.chainName as string,
      };

      if (type === 'cross-reserve') {
        const offsetReserve = idMap.get(nonSelf[0]);
        if (!offsetReserve) continue;
        if (offsetReserve.borrowDisabled === true) continue;
        if (!usableForOffsetPosition(offsetReserve)) continue;
        scenario.offsetSymbol = offsetReserve.tokenSymbol as string;
        scenario.offsetMarketLabel = getMarketChipLabel(
          offsetReserve.marketName as string,
          offsetReserve.chainName as string,
        );
        scenario.offsetReserveId = offsetReserve.reserveId;
      }

      seen.add(dedupKey);
      scenarios.push(scenario);
    }
  }

  // Sort: cross-reserve first, then by APR descending
  scenarios.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'cross-reserve' ? -1 : 1;
    return b.targetApr - a.targetApr;
  });

  return scenarios;
}

// ─── Cross-asset pairing scenarios (AAV-1308) ──────────────────────

/** Wire shape of a Merkl min(1,2) cross-asset pairing constraint. */
interface CrossAssetPairing {
  sourceSide?: 'supply' | 'borrow';
  pairedReserveId: string;
  pairedSide: 'supply' | 'borrow';
  discountFactor: number;
}

/** A portfolio cross-asset pairing scenario to exercise in e2e. */
export interface CrossAssetScenario {
  sourceSymbol: string;
  sourceMarketLabel: string;
  sourceReserveId: string;
  sourceSide: 'supply' | 'borrow';
  pairedSymbol: string;
  pairedMarketLabel: string;
  pairedReserveId: string;
  pairedSide: 'supply' | 'borrow';
  discountFactor: number;
  chainName: string;
  /** Sum of computable breakdown APRs (percent points) — ranking only. */
  apr: number;
}

const PAIRING_SIDES: Array<'supply' | 'borrow'> = ['supply', 'borrow'];

/**
 * Discover Merkl cross-asset pairing (min(1,2)) scenarios from /markets
 * reserves (ported from portfolio-cross-asset-pairing.spec.ts — AAV-1308).
 *
 * Two gate families, both mirroring the app rather than importing it:
 * 1. Renderability — both rate sides are scanned (`merklSupplys` and
 *    `merklBorrows`) and every candidate group is summed through
 *    `isComputableMerklCampaign`, so a selected scenario renders a numeric
 *    incentive, never the '—' shape that made AAV-1280 flaky.
 * 2. Position feasibility — `usableForSimulatedPosition` on both endpoints, so
 *    no ladder step is clamped into a false green.
 *
 * The UI ignores `pairing.sourceSide` (`computeCrossAssetNetEligible` scales the
 * current side's gross), and so does discovery.
 */
export function discoverCrossAssetPairingScenarios(reserves: DiscoveryReserve[], nowIso: string): CrossAssetScenario[] {
  const idMap = indexReservesById(reserves);

  const scenarios: CrossAssetScenario[] = [];
  const seen = new Set<string>();

  for (const r of reserves) {
    const sourceReserveId = r.reserveId;
    if (typeof sourceReserveId !== 'string' || sourceReserveId === '') continue;
    if (!hasRunnerIdentity(r)) continue;
    for (const side of PAIRING_SIDES) {
      if (!usableForSimulatedPosition(r, side)) continue;

      for (const group of merklGroupsForSide(r, side)) {
        const pairing = (group as { crossAssetPairing?: CrossAssetPairing | null }).crossAssetPairing;
        if (!pairing || typeof pairing.pairedReserveId !== 'string') continue;
        // A self-pair would make the runner add the reserve twice and overwrite
        // its own source position on the next fill.
        if (pairing.pairedReserveId === sourceReserveId) continue;
        const pairedSide = pairing.pairedSide;
        if (pairedSide !== 'supply' && pairedSide !== 'borrow') continue;

        const apr = computableAprPercent(breakdownsOfGroup(group), nowIso);
        if (apr <= 0) continue;

        const paired = idMap.get(pairing.pairedReserveId);
        if (!paired || !hasRunnerIdentity(paired)) continue;
        // The fill helpers locate portfolio inputs by accessible name (token
        // symbol), so a same-symbol pair types into whichever row comes first.
        if (paired.tokenSymbol === r.tokenSymbol) continue;
        if (!usableForSimulatedPosition(paired, pairedSide)) continue;

        const dedupKey = `${sourceReserveId}:${side}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        scenarios.push({
          sourceSymbol: r.tokenSymbol as string,
          sourceMarketLabel: getMarketChipLabel(r.marketName as string, r.chainName as string),
          sourceReserveId,
          sourceSide: side,
          pairedSymbol: paired.tokenSymbol as string,
          pairedMarketLabel: getMarketChipLabel(paired.marketName as string, paired.chainName as string),
          pairedReserveId: pairing.pairedReserveId,
          pairedSide,
          discountFactor: pairing.discountFactor,
          chainName: r.chainName as string,
          apr,
        });
      }
    }
  }

  // Highest-impact scenarios first — the spec keeps the top two.
  return scenarios.sort((a, b) => b.apr - a.apr);
}

/**
 * Index of a row deeper than the first whose market chip differs from the market of the
 * first labelled row, or -1 when every visible row shares one market.
 *
 * Filtering by a market the whole page already belongs to cannot reorder anything, so an
 * assertion of "the expanded row gets pinned to the top anchor" on such a row would encode
 * which markets happened to sit on top of the live snapshot, not the pin behaviour.
 */
export function pickReorderCapableRowIndex(labels: (string | null)[]): number {
  const clean = labels.map((l) => (l ?? '').trim());
  const reference = clean.find((l) => l !== '');
  if (reference === undefined) return -1;
  return clean.findIndex((l, i) => i > 0 && l !== '' && l !== reference);
}
