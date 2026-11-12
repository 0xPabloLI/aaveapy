import type { ReserveWithSpread } from '@/types/aave';

export type ReserveKeySource = Pick<ReserveWithSpread, 'reserveId'>;

/**
 * Returns the canonical reserve key for UI/state lookups.
 *
 * The backend guarantees `reserveId` is globally unique (V4 includes
 * `:hubName` suffix). Frontend treats it as an opaque string.
 */
export const getReserveKey = (reserve: ReserveKeySource): string => {
  return reserve.reserveId.trim();
};

/**
 * Builds a Map<reserveId, ReserveWithSpread> for O(1) lookup.
 * Key is `reserveId.trim()` to match `getReserveKey` semantics.
 */
export const buildReserveMap = (reserves: ReserveWithSpread[]): Map<string, ReserveWithSpread> => {
  const map = new Map<string, ReserveWithSpread>();
  for (const r of reserves) {
    const key = r.reserveId.trim();
    if (!map.has(key)) {
      map.set(key, r);
    }
  }
  return map;
};

export type ReserveMap = Map<string, ReserveWithSpread>;

/**
 * Composite key for (chainId, tokenAddress) lookup.
 * Both fields are available in SDK, onchain, and backend data.
 */
type ChainTokenKey = `${number}:${string}`;

function toChainTokenKey(chainId: number, tokenAddress: string): ChainTokenKey {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

export const AMBIGUOUS_FALLBACK = Symbol('ambiguousFallback');

/**
 * Builds a Map<(chainId,tokenAddress), ReserveWithSpread> for O(1) lookup.
 * This is the correct way to find a reserve when you have chainId + tokenAddress
 * but don't know the backend's reserveId format.
 *
 * When multiple reserves share the same (chainId, tokenAddress), the first
 * is kept and marked with _ambiguousFallback for runtime warning.
 */
export const buildReserveLookupByChainAndToken = (
  reserves: ReserveWithSpread[],
): Map<string, ReserveWithSpread & { _ambiguousFallback?: boolean }> => {
  const map = new Map<string, ReserveWithSpread & { _ambiguousFallback?: boolean }>();
  const keyCounts = new Map<string, number>();
  for (const r of reserves) {
    if (r.chainId != null && r.tokenAddress) {
      const key = toChainTokenKey(r.chainId, r.tokenAddress);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
      if (!map.has(key)) {
        map.set(key, r);
      }
    }
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      const existing = map.get(key);
      if (existing) map.set(key, { ...existing, _ambiguousFallback: true });
    }
  }
  return map;
};

export type ReserveChainTokenMap = Map<string, ReserveWithSpread & { _ambiguousFallback?: boolean }>;

export { toChainTokenKey };

const V4_SPOKE_ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

/**
 * Canonical join key for a V4 spoke.
 *
 * The address book's `SPOKES` keys are constant names (`MAIN_SPOKE`); the API's
 * `spokeName` is a display name (`Main`). Neither matches the other, so both sides key
 * on the spoke address instead: `deriveV4ReservesBySpoke` reads it out of `reserveId`
 * (which carries it lowercased) and `getV4UserPositionsAllSpokes` passes the address
 * book's EIP-55 spelling. This normalises the two to one key (AAV-1356).
 *
 * Returns null when the value cannot be a spoke address, so callers skip the entry
 * instead of storing a key that can never match.
 */
export function toV4SpokeKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const normalized = address.trim().toLowerCase();
  return V4_SPOKE_ADDRESS_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Composes a reserveId string matching the backend format.
 *
 * V3: `{chainId}:{poolAddress}:{tokenAddress}`
 * V4: `{chainId}:{poolAddress}:{tokenAddress}:{hubAddress}`
 *
 * All address components are lowercased for consistent matching.
 * Returns undefined if any required component is missing.
 */
export function composeReserveId(
  chainId: number,
  poolAddress: string,
  tokenAddress: string,
  hubAddress?: string,
): string | undefined {
  if (chainId <= 0 || !poolAddress || !tokenAddress) return undefined;
  const base = `${chainId}:${poolAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`;
  return hubAddress ? `${base}:${hubAddress.toLowerCase()}` : base;
}
