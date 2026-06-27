import { describe, expect, it } from 'vitest';

import {
  calculateDeficitShareRatio,
  computeDeficitDisplay,
  formatReserveDeficitModeValue,
  formatReserveDeficitTokenCompact,
  getDeficitSeverity,
  getReserveDeficitTokenAmount,
  getReserveDeficitUsdAmount,
  hasReserveDeficit,
} from './deficit';

describe('deficit helpers', () => {
  it('parses raw deficit with reserve decimals', () => {
    const reserve = {
      deficit: '51198023044',
      decimals: 6,
      tokenSymbol: 'USDC',
    };

    expect(hasReserveDeficit(reserve)).toBe(true);
    expect(getReserveDeficitTokenAmount(reserve)).toBeCloseTo(51198.023044, 6);
    expect(formatReserveDeficitTokenCompact(reserve)).toBe('51.20K');
  });

  it('computes usd deficit when token price is available', () => {
    const reserve = {
      deficit: '146401',
      decimals: 8,
      tokenSymbol: 'WBTC',
    };

    expect(getReserveDeficitTokenAmount(reserve)).toBeCloseTo(0.00146401, 8);
    expect(getReserveDeficitUsdAmount(reserve, 70000)).toBeCloseTo(102.4807, 4);
  });

  it('formats display value by scenario mode', () => {
    const reserve = {
      deficit: '2700140833079033420926',
      decimals: 18,
      tokenSymbol: 'DAI',
    };

    expect(formatReserveDeficitModeValue(reserve, 'token', 1)).toBe('2.70K DAI');
    expect(formatReserveDeficitModeValue(reserve, 'usd', 1)).toBe('$2.70K');
  });

  it('falls back safely when deficit is absent or invalid', () => {
    const noDeficit = {
      deficit: '0',
      decimals: 18,
      tokenSymbol: 'ETH',
    };
    const invalidDeficit = {
      deficit: 'not-a-number',
      decimals: 18,
      tokenSymbol: 'ETH',
    };

    expect(hasReserveDeficit(noDeficit)).toBe(false);
    expect(formatReserveDeficitModeValue(noDeficit, 'usd', 1800)).toBe('-');
    expect(formatReserveDeficitModeValue(invalidDeficit, 'token', 1800)).toBe('-');
  });

  it('computes deficit share using deficit + total supplied denominator', () => {
    expect(calculateDeficitShareRatio({ deficitUsd: 100, totalSuppliedUsd: 900 })).toBeCloseTo(0.1, 10);
    expect(calculateDeficitShareRatio({ deficitUsd: 100, totalSuppliedUsd: 0 })).toBeCloseTo(1, 10);
  });

  it('maps deficit ratio to severity tiers', () => {
    expect(getDeficitSeverity(null)).toBe('neutral');
    expect(getDeficitSeverity(0.02)).toBe('neutral');
    expect(getDeficitSeverity(0.1)).toBe('warning');
    expect(getDeficitSeverity(0.25)).toBe('critical');
  });

  describe('computeDeficitDisplay', () => {
    const reserve = {
      deficit: '51198023044',
      decimals: 6,
    };
    const tokenPrice = 1;
    const totalSuppliedUsd = 1_000_000;

    it('returns hasDeficit=true when deficit exists with price', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, totalSuppliedUsd, 'usd');
      expect(d.hasDeficit).toBe(true);
      expect(d.deficitUsd).not.toBeNull();
      expect(d.deficitTokenLabel).toBeDefined();
      expect(d.deficitInlineValue).toBeTruthy();
    });

    it('returns correct severity and text class based on ratio', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, totalSuppliedUsd, 'usd');
      expect(d.deficitShareRatio).not.toBeNull();
      expect(d.deficitSeverity).toBe('neutral');
      expect(d.deficitTextClass).toBe('text-muted-foreground/60');
      expect(d.isNeutralDeficit).toBe(true);
    });

    it('returns warning severity when ratio >= 8%', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, 500_000, 'usd');
      expect(d.deficitSeverity).toBe('warning');
      expect(d.deficitTextClass).toBe('ds-text-amber-600');
    });

    it('returns critical severity when ratio >= 20%', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, 100_000, 'usd');
      expect(d.deficitSeverity).toBe('critical');
      expect(d.deficitTextClass).toBe('ds-text-amber-500');
    });

    it('returns hasDeficit=false when no deficit', () => {
      const noDeficit = { deficit: '0', decimals: 6 };
      const d = computeDeficitDisplay(noDeficit, tokenPrice, totalSuppliedUsd, 'usd');
      expect(d.hasDeficit).toBe(false);
      expect(d.deficitUsd).toBeNull();
      expect(d.deficitInlineValue).toBe('-');
    });

    it('uses token compact value when inputMode is token', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, totalSuppliedUsd, 'token');
      expect(d.deficitInlineValue).toBe('51.20K');
    });

    it('uses usd formatted value when inputMode is usd', () => {
      const d = computeDeficitDisplay(reserve, tokenPrice, totalSuppliedUsd, 'usd');
      expect(d.deficitInlineValue).toMatch(/\$/);
    });
  });
});
