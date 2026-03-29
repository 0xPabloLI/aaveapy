import { describe, expect, it } from 'vitest';

import {
  formatReserveDeficitModeValue,
  formatReserveDeficitTokenExact,
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
    expect(formatReserveDeficitTokenExact(reserve)).toBe('51198.023044');
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
});
