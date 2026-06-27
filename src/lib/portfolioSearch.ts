/**
 * Search ranking for the Portfolio panel token picker.
 *
 * Tier 1 (rank): exact symbol > prefix > substring (lower = better).
 * Tier 2 (TVL): higher TVL first within the same rank.
 *
 * IMPORTANT: `ReserveWithSpread` does NOT carry a precomputed `reserveSizeUsd`
 * field. TVL must be derived from `reserveSize` (raw units), `decimals` and
 * `tokenPrice` via `nativeToUsd`. A previous implementation referenced
 * `r.reserveSizeUsd` which was always `undefined`, silently disabling the
 * tie-breaker. This module fixes that and is unit-tested.
 */
import type { ReserveWithSpread } from '@/types/aave';
import { normalizeTokenSymbolForSearch } from './tokenSymbolNormalization';
import { nativeToUsd } from './scenarioSize';

export const getReserveTvlUsd = (r: ReserveWithSpread): number => {
  const usd = nativeToUsd(r.supplied, r.decimals, r.tokenPrice);
  return usd != null && Number.isFinite(usd) ? usd : 0;
};

export interface PortfolioSearchOptions {
  limit?: number;
}

export const PORTFOLIO_SEARCH_HARD_LIMIT = 500;

export const filterAndRankReservesForPortfolioSearch = (
  reserves: ReserveWithSpread[],
  query: string,
  { limit = PORTFOLIO_SEARCH_HARD_LIMIT }: PortfolioSearchOptions = {},
): ReserveWithSpread[] => {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const qNorm = normalizeTokenSymbolForSearch(query);

  type Scored = { reserve: ReserveWithSpread; rank: number; tvl: number };
  const scored: Scored[] = [];

  for (const r of reserves) {
    const sym = r.tokenSymbol.toLowerCase();
    const symNorm = normalizeTokenSymbolForSearch(r.tokenSymbol);
    let rank = -1;
    if (sym === q || (qNorm && symNorm === qNorm)) rank = 0;
    else if (sym.startsWith(q) || (qNorm && symNorm.startsWith(qNorm))) rank = 1;
    else if (sym.includes(q) || (qNorm && symNorm.includes(qNorm))) rank = 2;
    if (rank < 0) continue;
    scored.push({ reserve: r, rank, tvl: getReserveTvlUsd(r) });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.tvl - a.tvl;
  });

  return scored.slice(0, limit).map((s) => s.reserve);
};
