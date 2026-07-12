/**
 * Tydro deep-links. Tydro currently mirrors Aave's URL structure but only
 * serves the Ink market. We only build URLs for `AaveV3Ink*` markets — other
 * markets return `null` so the UI can hide the option.
 *
 * Verified URL patterns from https://app.tydro.com/:
 *   - Reserve overview: /reserve-overview/?underlyingAsset=0x..&marketName=proto_ink_v3
 *   - Markets list:     /markets/?marketName=proto_ink_v3
 */

const TYDRO_APP_BASE = 'https://app.tydro.com';
const TYDRO_INK_MARKET = 'proto_ink_v3';

export function isTydroSupportedMarket(marketName: string): boolean {
  if (!marketName) return false;
  return marketName === 'AaveV3Ink' || marketName === 'AaveV3InkWhitelabel';
}

export function buildTydroReserveUrl(reserve: {
  marketName: string;
  tokenAddress: string;
}): string | null {
  if (!isTydroSupportedMarket(reserve.marketName) || !reserve.tokenAddress) return null;
  const underlyingAsset = reserve.tokenAddress.toLowerCase();
  return `${TYDRO_APP_BASE}/reserve-overview/?underlyingAsset=${encodeURIComponent(
    underlyingAsset,
  )}&marketName=${encodeURIComponent(TYDRO_INK_MARKET)}`;
}

export function buildTydroMarketUrl(marketName: string): string | null {
  if (!isTydroSupportedMarket(marketName)) return null;
  return `${TYDRO_APP_BASE}/markets/?marketName=${encodeURIComponent(TYDRO_INK_MARKET)}`;
}
