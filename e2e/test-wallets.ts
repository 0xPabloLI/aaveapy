/**
 * Shared test wallet addresses for E2E and integration tests.
 *
 * Addresses are view-only (no private keys) and hold Aave positions
 * suitable for testing portfolio / wallet-sync features.
 *
 * Env vars (E2E_WATCH_ADDRESS, E2E_WATCH_ADDRESS_ALT) take precedence
 * so CI can inject different addresses without changing source.
 */

/** Primary wallet — holds Aave V3 positions on mainnet. */
export const DEFAULT_WATCH_ADDRESS = '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314';

/** Convenience: read from env or fall back to the default. */
export const WATCH_ADDRESS: string | undefined =
  process.env.E2E_WATCH_ADDRESS ?? DEFAULT_WATCH_ADDRESS;
