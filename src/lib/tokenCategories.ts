import { STABLECOINS, ETH_RELATED, BTC_RELATED, PENDLE_TOKENS } from '@/types/aave';
import { normalizeTokenSymbolAliasesUpper, normalizeTokenSymbolBaseUpper } from '@/lib/tokenSymbolNormalization';

export interface TokenCategoryOverrides {
  stablecoins?: string[];
  ethRelated?: string[];
  btcRelated?: string[];
}

export interface TokenCategoryGroups {
  stablecoins: string[];
  ethRelated: string[];
  btcRelated: string[];
}

const normalizeBaseSymbol = (symbol: string): string => {
  return normalizeTokenSymbolBaseUpper(symbol);
};

const normalizeStableSymbol = (symbol: string): string => {
  const normalized = normalizeBaseSymbol(symbol)
    .replace(/^W/, '')
    .replace(/USD₮0/g, 'USDT0');
  const aliased = normalizeTokenSymbolAliasesUpper(normalized);
  if (aliased === 'CEUR') return 'EURM';
  if (aliased === 'EURM') return 'CEUR';
  return aliased;
};

const normalizeEthSymbol = (symbol: string): string => {
  return normalizeBaseSymbol(symbol).replace(/WRSETH/g, 'RSETH');
};

const normalizeBtcSymbol = (symbol: string): string => {
  return normalizeBaseSymbol(symbol).replace(/^W/, '');
};

const matchesTokenGroup = (
  symbol: string,
  tokens: string[],
  normalize: (value: string) => string
): boolean => {
  const normalized = normalize(symbol);
  return tokens.some((token) => normalized.endsWith(token.toUpperCase()));
};

const mergeTokenGroups = (baseTokens: string[], extraTokens?: string[]): string[] => {
  if (!extraTokens || extraTokens.length === 0) return baseTokens;
  const merged = new Set<string>();
  baseTokens.forEach((token) => merged.add(token.toUpperCase()));
  extraTokens.forEach((token) => merged.add(token.toUpperCase()));
  return Array.from(merged);
};

export const buildTokenCategoryGroups = (
  overrides?: TokenCategoryOverrides
): TokenCategoryGroups => {
  return {
    stablecoins: mergeTokenGroups(STABLECOINS, overrides?.stablecoins),
    ethRelated: mergeTokenGroups(ETH_RELATED, overrides?.ethRelated),
    btcRelated: mergeTokenGroups(BTC_RELATED, overrides?.btcRelated),
  };
};

export const isStablecoinSymbol = (
  symbol: string,
  groups?: TokenCategoryGroups
): boolean => {
  return matchesTokenGroup(symbol, groups?.stablecoins ?? STABLECOINS, normalizeStableSymbol);
};

export const isEthRelatedSymbol = (
  symbol: string,
  groups?: TokenCategoryGroups
): boolean => {
  return matchesTokenGroup(symbol, groups?.ethRelated ?? ETH_RELATED, normalizeEthSymbol);
};

export const isBtcRelatedSymbol = (
  symbol: string,
  groups?: TokenCategoryGroups
): boolean => {
  return matchesTokenGroup(symbol, groups?.btcRelated ?? BTC_RELATED, normalizeBtcSymbol);
};

export const isPendleSymbol = (symbol: string): boolean => {
  const normalized = normalizeBaseSymbol(symbol);
  return PENDLE_TOKENS.some((token) => normalized.startsWith(token.toUpperCase()));
};
