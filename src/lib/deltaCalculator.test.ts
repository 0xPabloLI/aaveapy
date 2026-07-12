import { describe, it, expect } from 'vitest';
import { computeDelta, computeEffectiveAmount, clampDelta } from './deltaCalculator';

describe('computeDelta', () => {
  it('wallet position with no change → delta = 0', () => {
    const result = computeDelta({
      amount: '1000',
      walletValue: 1000,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(0);
    expect(result.effectiveAmountUsd).toBe(1000);
    expect(result.walletValueUsd).toBe(1000);
    expect(result.isManualPosition).toBe(false);
  });

  it('wallet position with extra supply → delta = +500', () => {
    const result = computeDelta({
      amount: '1500',
      walletValue: 1000,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(500);
    expect(result.effectiveAmountUsd).toBe(1500);
    expect(result.walletValueUsd).toBe(1000);
  });

  it('wallet position with partial withdrawal → delta = -500', () => {
    const result = computeDelta({
      amount: '500',
      walletValue: 1000,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(-500);
    expect(result.effectiveAmountUsd).toBe(500);
    expect(result.walletValueUsd).toBe(1000);
  });

  it('wallet position fully withdrawn → delta = -walletValue', () => {
    const result = computeDelta({
      amount: '0',
      walletValue: 1000,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(-1000);
    expect(result.effectiveAmountUsd).toBe(0);
  });

  it('manual position (no wallet) → delta = full amount', () => {
    const result = computeDelta({
      amount: '2000',
      walletValue: null,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(2000);
    expect(result.effectiveAmountUsd).toBe(2000);
    expect(result.walletValueUsd).toBe(0);
    expect(result.isManualPosition).toBe(true);
  });

  it('token mode converts to USD', () => {
    const result = computeDelta({
      amount: '1000',
      walletValue: 500,
      inputMode: 'token',
      tokenPrice: 0.5,
    });
    expect(result.effectiveAmountUsd).toBe(500);
    expect(result.deltaUsd).toBe(0);
  });

  it('token mode with extra supply', () => {
    const result = computeDelta({
      amount: '2000',
      walletValue: 500,
      inputMode: 'token',
      tokenPrice: 0.5,
    });
    expect(result.effectiveAmountUsd).toBe(1000);
    expect(result.deltaUsd).toBe(500);
  });

  it('empty amount string → effective = 0, delta = -walletValue', () => {
    const result = computeDelta({
      amount: '',
      walletValue: 800,
      inputMode: 'usd',
    });
    expect(result.effectiveAmountUsd).toBe(0);
    expect(result.deltaUsd).toBe(-800);
  });

  it('zero wallet value (not null) → delta = effective', () => {
    const result = computeDelta({
      amount: '500',
      walletValue: 0,
      inputMode: 'usd',
    });
    expect(result.deltaUsd).toBe(500);
    expect(result.isManualPosition).toBe(false);
  });

  it('token mode with missing price → effective = 0', () => {
    const result = computeDelta({
      amount: '1000',
      walletValue: 500,
      inputMode: 'token',
    });
    expect(result.effectiveAmountUsd).toBe(0);
    expect(result.deltaUsd).toBe(-500);
  });

  it('token mode with zero price → effective = 0', () => {
    const result = computeDelta({
      amount: '1000',
      walletValue: 500,
      inputMode: 'token',
      tokenPrice: 0,
    });
    expect(result.effectiveAmountUsd).toBe(0);
    expect(result.deltaUsd).toBe(-500);
  });
});

describe('computeEffectiveAmount', () => {
  it('wallet + positive delta', () => {
    expect(computeEffectiveAmount(1000, 500)).toBe(1500);
  });

  it('wallet + negative delta', () => {
    expect(computeEffectiveAmount(1000, -500)).toBe(500);
  });

  it('wallet + delta = 0 (full withdrawal)', () => {
    expect(computeEffectiveAmount(1000, -1000)).toBe(0);
  });

  it('delta exceeds wallet → clamped to 0', () => {
    expect(computeEffectiveAmount(500, -800)).toBe(0);
  });

  it('manual position (wallet = 0)', () => {
    expect(computeEffectiveAmount(0, 2000)).toBe(2000);
  });
});

describe('clampDelta', () => {
  it('supply: delta cannot go below -walletValue', () => {
    expect(clampDelta(-1500, 1000, 'supply')).toBe(-1000);
  });

  it('supply: valid negative delta passes through', () => {
    expect(clampDelta(-500, 1000, 'supply')).toBe(-500);
  });

  it('supply: positive delta passes through', () => {
    expect(clampDelta(500, 1000, 'supply')).toBe(500);
  });

  it('borrow: delta cannot go below -walletValue', () => {
    expect(clampDelta(-2000, 800, 'borrow')).toBe(-800);
  });

  it('borrow: valid negative delta passes through', () => {
    expect(clampDelta(-300, 800, 'borrow')).toBe(-300);
  });

  it('zero walletValue → only non-negative delta allowed', () => {
    expect(clampDelta(-500, 0, 'supply')).toBe(0);
    expect(clampDelta(500, 0, 'supply')).toBe(500);
  });
});
