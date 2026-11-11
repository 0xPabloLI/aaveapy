/**
 * Expression keys of `underlyingAssetMap` in `reservePatches.ts`, and the
 * address-book asset renames they have to survive.
 *
 * Those keys are expressions — `[AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]`
 * — so their runtime values cannot be resolved statically and both
 * `check-reserve-patches-upstream.mjs` and `sync-reserve-patches-upstream.mjs`
 * compare them as *strings*. That makes the comparison sensitive to spelling:
 * when the address book renames an asset, the local key and the upstream key
 * describe one reserve while comparing unequal. The drift check then reports
 * phantom drift, and the sync re-appends the stale spelling — which throws on
 * evaluation and takes the whole Hardcode Sync down with it (issue #770).
 *
 * Canonicalising both sides through `ASSET_RENAMES` puts the comparison back on
 * identity instead of spelling.
 */

/**
 * Assets renamed inside a market's `ASSETS` record, as
 * `{ [market]: { [name upstream still uses]: name we use } }`.
 *
 * Verified 2026-11-11 by comparing `UNDERLYING` between
 * `@aave-dao/aave-address-book` 4.73.0 — the last release exposing `USDC` on
 * these markets — and 4.77.6. The address is unchanged; only the key moved:
 *
 *   Arbitrum  0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
 *   Optimism  0x7F5c764cBc14f9669B88837ca1490cCa17c31607
 *   Polygon   0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
 *
 * `USDCn` is a *different* token (native USDC), so it is deliberately not the
 * rename target. Every other market keeps a plain `USDC` — its own native one —
 * and Gnosis exposes both, so the rename is scoped per market rather than
 * applied globally.
 */
const ASSET_RENAMES = {
  AaveV3Arbitrum: { USDC: 'USDCe' },
  AaveV3Optimism: { USDC: 'USDCe' },
  AaveV3Polygon: { USDC: 'USDCe' },
};

function normalizeExpressionKey(value) {
  return value.replace(/\s+/g, '');
}

/**
 * Rewrite a known asset rename to the name this repo uses. Anything unrecognised
 * passes through untouched, so a genuinely new upstream key still reads as drift
 * rather than being silently absorbed.
 */
export function canonicalizeExpressionKey(value) {
  const normalized = normalizeExpressionKey(value);
  return normalized.replace(/^(AaveV[34][A-Za-z0-9_]*)\.ASSETS\.([A-Za-z0-9_$]+)\./, (whole, market, asset) => {
    const renamed = ASSET_RENAMES[market]?.[asset];
    return renamed ? `${market}.ASSETS.${renamed}.` : whole;
  });
}

/**
 * Expression keys used as `underlyingAssetMap` keys, canonicalised so one
 * reserve compares equal whether it is spelled with the current name or the
 * name upstream still carries.
 */
export function extractExpressionKeys(content) {
  const regex = /\[([A-Za-z0-9_.]+\.toLowerCase\(\))\]\s*:/g;
  const values = new Set();
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    values.add(canonicalizeExpressionKey(match[1]));
  }
  return values;
}
