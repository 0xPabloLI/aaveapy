/**
 * Default token decimals for ERC-20 tokens on EVM chains.
 *
 * Most ERC-20 tokens use 18 decimals (matching ETH/WEI). The backend `/markets`
 * API omits `decimals` for reserves where it equals 18, so the frontend must
 * default to 18 when the field is absent.
 *
 * **Rule**: Always use `reserve.decimals ?? DEFAULT_TOKEN_DECIMALS` instead of
 * bare `reserve.decimals`. This ensures native→USD conversions (positionCap,
 * scenario size, deficit, etc.) work correctly for the ~66% of reserves that
 * don't include the field.
 *
 * **Why not 6 for USDC/USDT?** Those stablecoins do have 6 decimals, and the
 * backend *does* include `decimals: 6` for them. The default only applies when
 * the field is missing entirely, which happens for standard 18-decimal tokens.
 */
export const DEFAULT_TOKEN_DECIMALS = 18;
