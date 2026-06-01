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
export const buildReserveMap = (
  reserves: ReserveWithSpread[],
): Map<string, ReserveWithSpread> => {
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

/**
 * Builds a Map<(chainId,tokenAddress), ReserveWithSpread> for O(1) lookup.
 * This is the correct way to find a reserve when you have chainId + tokenAddress
 * but don't know the backend's reserveId format.
 */
export const buildReserveLookupByChainAndToken = (
  reserves: ReserveWithSpread[],
): Map<string, ReserveWithSpread> => {
  const map = new Map<string, ReserveWithSpread>();
  for (const r of reserves) {
    if (r.chainId != null && r.tokenAddress) {
      const key = toChainTokenKey(r.chainId, r.tokenAddress);
      if (!map.has(key)) {
        map.set(key, r);
      }
    }
  }
  return map;
};

export type ReserveChainTokenMap = Map<string, ReserveWithSpread>;

export { toChainTokenKey };
