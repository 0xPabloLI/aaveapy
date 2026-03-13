import { STABLECOINS } from '@/types/aave';

export const COINGECKO_STABLE_TOKEN_TTL_MS = 5 * 60 * 1000;
export const COINGECKO_VOLATILE_TOKEN_TTL_MS = 60 * 1000;

const stableSymbols = new Set(STABLECOINS.map((symbol) => symbol.toUpperCase()));

export const getCoingeckoBackupPriceTtlMs = (tokenSymbol?: string | null): number => {
  if (!tokenSymbol) return COINGECKO_VOLATILE_TOKEN_TTL_MS;
  const normalized = tokenSymbol.trim().toUpperCase();
  if (!normalized) return COINGECKO_VOLATILE_TOKEN_TTL_MS;
  return stableSymbols.has(normalized)
    ? COINGECKO_STABLE_TOKEN_TTL_MS
    : COINGECKO_VOLATILE_TOKEN_TTL_MS;
};
