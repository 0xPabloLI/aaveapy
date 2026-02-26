import { describe, expect, it } from 'vitest';

import {
  normalizeTokenSymbolAliasesUpper,
  normalizeTokenSymbolBaseUpper,
  normalizeTokenSymbolForAsciiLower,
  normalizeTokenSymbolForSearch,
} from './tokenSymbolNormalization';

describe('tokenSymbolNormalization', () => {
  it('normalizes base symbol wrappers and suffixes', () => {
    expect(normalizeTokenSymbolBaseUpper('m.usdc')).toBe('USDC');
    expect(normalizeTokenSymbolBaseUpper('weth.e')).toBe('WETH');
    expect(normalizeTokenSymbolBaseUpper(' USD₮ ')).toBe('USD₮');
  });

  it('normalizes alias symbols borrowed from backend merit matching', () => {
    expect(normalizeTokenSymbolAliasesUpper('USD₮')).toBe('USDT');
    expect(normalizeTokenSymbolAliasesUpper('USD₮0')).toBe('USDT');
    expect(normalizeTokenSymbolAliasesUpper('USDT0')).toBe('USDT');
    expect(normalizeTokenSymbolAliasesUpper('USDTE')).toBe('USDT');
    expect(normalizeTokenSymbolAliasesUpper('USDC0')).toBe('USDC');
  });

  it('normalizes search values to a single comparable token key', () => {
    expect(normalizeTokenSymbolForSearch('USD₮')).toBe('USDT');
    expect(normalizeTokenSymbolForSearch('usdt0')).toBe('USDT');
    expect(normalizeTokenSymbolForSearch('m.usdc')).toBe('USDC');
    expect(normalizeTokenSymbolForSearch('WETH.E')).toBe('WETH');
  });

  it('normalizes optional values for ascii lower comparisons', () => {
    expect(normalizeTokenSymbolForAsciiLower('USD₮0')).toBe('usdt');
    expect(normalizeTokenSymbolForAsciiLower('USDTE')).toBe('usdt');
    expect(normalizeTokenSymbolForAsciiLower('USDC0')).toBe('usdc');
    expect(normalizeTokenSymbolForAsciiLower(null)).toBeUndefined();
    expect(normalizeTokenSymbolForAsciiLower('')).toBeUndefined();
  });
});
