import { describe, expect, it } from 'vitest';

import { convertUsdToInputValue, getScenarioSupplySizeUsd } from './scenarioSize';

describe('getScenarioSupplySizeUsd', () => {
  it('keeps current size when reserve is already above cap', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 8660,
        supplyCapUsd: 1,
        rawSupplyInput: '1',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(8660);
  });

  it('caps growth at supply cap when reserve is below cap', () => {
    expect(
      getScenarioSupplySizeUsd({
        reserveSizeUsd: 100,
        supplyCapUsd: 120,
        rawSupplyInput: '50',
        inputMode: 'usd',
        tokenPrice: 1,
      }),
    ).toBe(120);
  });
});

describe('convertUsdToInputValue', () => {
  it('returns USD string in usd mode', () => {
    expect(convertUsdToInputValue(1000, 'usd', 2500)).toBe('1000');
  });

  it('converts to token amount in token mode', () => {
    expect(convertUsdToInputValue(5000, 'token', 2500)).toBe('2');
  });

  it('returns empty string when usd is zero', () => {
    expect(convertUsdToInputValue(0, 'usd', 2500)).toBe('');
  });

  it('returns empty string when usd is negative', () => {
    expect(convertUsdToInputValue(-100, 'token', 2500)).toBe('');
  });

  it('falls back to USD string when tokenPrice is null in token mode', () => {
    expect(convertUsdToInputValue(1000, 'token', null)).toBe('1000');
  });

  it('falls back to USD string when tokenPrice is zero in token mode', () => {
    expect(convertUsdToInputValue(1000, 'token', 0)).toBe('1000');
  });
});
