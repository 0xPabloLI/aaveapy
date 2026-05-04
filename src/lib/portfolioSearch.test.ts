import { describe, it, expect } from 'vitest';
import {
  filterAndRankReservesForPortfolioSearch,
  getReserveTvlUsd,
} from './portfolioSearch';
import type { ReserveWithSpread } from '@/types/aave';

const mk = (
  symbol: string,
  marketName: string,
  reserveSizeTokens: number,
  tokenPrice: number,
  decimals = 18,
): ReserveWithSpread =>
  ({
    marketName,
    chainName: marketName,
    chainId: 1,
    tokenName: symbol,
    tokenSymbol: symbol,
    tokenAddress: `0x${symbol}-${marketName}`,
    reserveId: `${marketName}-${symbol}`,
    decimals,
    tokenPrice,
    reserveSize: String(BigInt(Math.floor(reserveSizeTokens)) * BigInt(10) ** BigInt(decimals)),
  }) as ReserveWithSpread;

describe('portfolioSearch', () => {
  describe('getReserveTvlUsd', () => {
    it('computes USD TVL from reserveSize/decimals/tokenPrice', () => {
      const r = mk('WETH', 'AaveV3Ink', 1000, 3000);
      expect(getReserveTvlUsd(r)).toBe(3_000_000);
    });

    it('returns 0 when fields are missing', () => {
      const r = { tokenSymbol: 'X' } as ReserveWithSpread;
      expect(getReserveTvlUsd(r)).toBe(0);
    });
  });

  describe('filterAndRankReservesForPortfolioSearch', () => {
    it('ranks exact > prefix > substring', () => {
      const reserves: ReserveWithSpread[] = [
        mk('XETH', 'A', 1, 1),     // substring "eth"
        mk('WETH', 'B', 1, 1),     // prefix? no - "weth" doesn't start with "eth"; substring
        mk('ETHX', 'C', 1, 1),     // prefix "eth"
        mk('ETH',  'D', 1, 1),     // exact
      ];
      const out = filterAndRankReservesForPortfolioSearch(reserves, 'eth');
      expect(out.map((r) => r.tokenSymbol)).toEqual(['ETH', 'ETHX', 'WETH', 'XETH']);
    });

    it('within same rank, higher TVL comes first', () => {
      const reserves: ReserveWithSpread[] = [
        mk('WETH', 'AaveV3Ethereum', 100, 3000),  // 300k
        mk('WETH', 'AaveV3Ink',      1000, 3000), // 3M  ← highest
        mk('WETH', 'AaveV3Base',     500, 3000),  // 1.5M
      ];
      const out = filterAndRankReservesForPortfolioSearch(reserves, 'weth');
      expect(out.map((r) => r.marketName)).toEqual([
        'AaveV3Ink',
        'AaveV3Base',
        'AaveV3Ethereum',
      ]);
    });

    it('normalizes USD₮ <-> USDT', () => {
      const reserves: ReserveWithSpread[] = [
        mk('USD₮', 'AaveV3Plasma', 100, 1),
        mk('USDC',  'AaveV3Ethereum', 100, 1),
      ];
      const out = filterAndRankReservesForPortfolioSearch(reserves, 'usdt');
      expect(out.map((r) => r.tokenSymbol)).toEqual(['USD₮']);
    });

    it('combines tiered rank then TVL: high-TVL substring still loses to low-TVL exact', () => {
      const reserves: ReserveWithSpread[] = [
        mk('WETH', 'AaveV3Ink',      10_000, 3000), // substring, huge TVL
        mk('ETH',  'AaveV3Ethereum', 1, 3000),      // exact, tiny TVL
      ];
      const out = filterAndRankReservesForPortfolioSearch(reserves, 'eth');
      expect(out[0].tokenSymbol).toBe('ETH');
      expect(out[1].tokenSymbol).toBe('WETH');
    });

    it('empty query returns no results', () => {
      const reserves: ReserveWithSpread[] = [mk('WETH', 'A', 1, 1)];
      expect(filterAndRankReservesForPortfolioSearch(reserves, '')).toEqual([]);
      expect(filterAndRankReservesForPortfolioSearch(reserves, '   ')).toEqual([]);
    });

    it('respects limit', () => {
      const reserves: ReserveWithSpread[] = Array.from({ length: 10 }, (_, i) =>
        mk('WETH', `M${i}`, i + 1, 1000),
      );
      const out = filterAndRankReservesForPortfolioSearch(reserves, 'weth', { limit: 3 });
      expect(out).toHaveLength(3);
      // Highest TVL first (M9, M8, M7)
      expect(out.map((r) => r.marketName)).toEqual(['M9', 'M8', 'M7']);
    });
  });
});
