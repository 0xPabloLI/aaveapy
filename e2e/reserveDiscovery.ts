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
 * 2. started < now < ended (missing/invalid boundaries are ignored)
 * 3. campaignType is not an AMOUNT variant
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

// ─── Campaign predicates ─────────────────────────────────────────────

const parseTime = (iso: string | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const parseApr = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Whether a single Merkl breakdown can produce a numeric incentive percent
 * in the UI at time `nowIso` (mirrors getMerklBreakdownApr + forecast gating).
 */
export function isComputableMerklCampaign(b: MerklBreakdown, nowIso: string): boolean {
  const now = parseTime(nowIso);
  const started = parseTime(b.campaignStartedAt);
  const ended = parseTime(b.campaignEndedAt);
  if (started != null && now != null && started > now) return false;
  if (ended != null && now != null && ended < now) return false;
  if (b.campaignType && AMOUNT_VARIANT_CAMPAIGN_TYPES.includes(b.campaignType)) return false;
  const apr = parseApr(b.campaignApr);
  if (apr > 0) return true;
  // APR=0 is only renderable for points-based campaigns (Tydro formula).
  const points = parseApr(b.pointsPerThousandUsd);
  return points > 0;
}

// ─── Reserve predicates ──────────────────────────────────────────────

function merklSupplyBreakdowns(r: DiscoveryReserve): MerklBreakdown[] {
  const groups = r.merklSupplys;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((g) => {
    const breakdowns = (g as { breakdowns?: unknown })?.breakdowns;
    return Array.isArray(breakdowns) ? (breakdowns as MerklBreakdown[]) : [];
  });
}

/**
 * Whether the reserve has at least one supply-side Merkl campaign the UI can
 * compute a numeric percent for. Merit arrays are deliberately NOT considered
 * (Merit was fully retired — AAV-1289).
 */
export function hasComputableSupplyIncentive(r: DiscoveryReserve, nowIso: string): boolean {
  return merklSupplyBreakdowns(r).some((b) => isComputableMerklCampaign(b, nowIso));
}

/**
 * Native supply APY plus the APR of every computable supply campaign —
 * used to rank candidates so the discovered reserve yields the most stable
 * numeric values.
 */
export function computeSupplyNetApyPercent(r: DiscoveryReserve, nowIso: string): number {
  const native = parseApr(r.supplyApy);
  const incentive = merklSupplyBreakdowns(r)
    .filter((b) => isComputableMerklCampaign(b, nowIso))
    .reduce((acc, b) => acc + parseApr(b.campaignApr), 0);
  return native + incentive;
}

function isUsableReserve(r: DiscoveryReserve): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  const ltv = r.ltv;
  return typeof ltv === 'number' && ltv > 0;
}

// ─── Supply room (mirrors app's marketMetrics fallback) ──────────────

/**
 * USD supply room — mirrors `availableSupplyRoomUsd` in
 * rateSimulationCalculator.ts (`nativeToUsd(suppliable)` preferred, else
 * `max(supplyCap − supplied, 0)`). Reserves with zero room clamp manual
 * positions to 0, rendering every portfolio cell as '—'.
 * Returns null when data is insufficient (treated as "don't exclude").
 */
export function getSupplyRoomUsd(r: DiscoveryReserve): number | null {
  const decimals = (r.decimals as number | undefined) ?? 18;
  const price = r.tokenPrice as number | undefined;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const toUsd = (raw: unknown): number | null => {
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return (value / Math.pow(10, decimals)) * price;
  };
  const suppliableUsd = toUsd(r.suppliable);
  if (suppliableUsd !== null) return suppliableUsd;
  const capUsd = toUsd(r.supplyCap);
  const suppliedUsd = toUsd(r.supplied);
  if (capUsd !== null && suppliedUsd !== null) return Math.max(capUsd - suppliedUsd, 0);
  return null;
}

// ─── Market label (mirrors src/lib/marketLabels.ts) ──────────────────

const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  AaveV3Ethereum: 'Core',
  AaveV3EthereumLido: 'Prime',
  AaveV3EthereumHorizon: 'Horizon RWA',
  AaveV3EthereumEtherFi: 'EtherFi',
};

export function getMarketChipLabel(marketName: string, chainName: string): string {
  if (chainName !== 'Ethereum') return chainName;
  if (ETHEREUM_MARKET_NAMES[marketName]) return ETHEREUM_MARKET_NAMES[marketName];
  if (marketName.startsWith('AaveV4')) {
    return marketName.replace(/^AaveV4/i, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return marketName;
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
