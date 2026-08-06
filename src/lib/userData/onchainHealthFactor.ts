/**
 * On-chain Health Factor baseline types (AAV-1253 P7).
 *
 * Provides the type definitions for on-chain HF data fetched via
 * `getUserAccountData()` multicalls on V3 Pool / V4 Spoke contracts.
 * The actual fetching hook (`useOnchainHealthFactor`) is in `hooks/`.
 */

export interface OnchainHfBaseline {
  /** On-chain HF value (human-readable, e.g. 1.5). null = HF = type(uint256).max (no debt). */
  healthFactor: number | null;
  /** On-chain total collateral in USD (optional, for validation/debug). */
  totalCollateralUsd?: number;
  /** On-chain total debt in USD (optional, for validation/debug). */
  totalDebtUsd?: number;
}

/** Map from poolKey (`${chainId}:${marketName}`) to on-chain HF baseline. */
export type OnchainHfMap = Map<string, OnchainHfBaseline>;

/**
 * Convert a WAD-format Health Factor (bigint, 1e18 = 1.0) to a human-readable number.
 *
 * Returns `null` when `wad` equals `type(uint256).max` (no debt — HF is "infinite").
 */
export function wadToHf(wad: bigint): number | null {
  // type(uint256).max = 2^256 - 1 — contract returns this when user has no debt
  const MAX_UINT256 = (2n ** 256n) - 1n;
  if (wad === MAX_UINT256) return null;

  const WAD = 10n ** 18n;
  return Number(wad / WAD) + Number(wad % WAD) / Number(WAD);
}
