import { describe, expect, it } from 'vitest';
import {
  simulateNativeRatesAfterSupply,
  simulateNativeRatesAfterBorrow,
  simulateNativeRatesAfterActions,
  hasRateCalcFields,
} from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import type { ReserveWithSpread } from '@/types/aave';

const baseRateInput: RateCalcInput = {
  decimals: 18,
  deficit: '0',
  availableLiquidity: '1000000000000000000000000',
  totalVariableDebt: '500000000000000000000000',
  reserveFactor: '1000',
  variableRateSlope1: '40000000000000000000000000',
  variableRateSlope2: '600000000000000000000000000',
  baseVariableBorrowRate: '0',
  optimalUsageRate: '800000000000000000000000000',
};

describe('simulateNativeRatesAfterSupply', () => {
  it('reduces utilization when supply amount increases', () => {
    const withoutDeposit = simulateNativeRatesAfterSupply(baseRateInput, '0');
    const withDeposit = simulateNativeRatesAfterSupply(baseRateInput, '100000');

    expect(withDeposit.utilizationRatePercent).toBeLessThan(withoutDeposit.utilizationRatePercent);
  });

  it('keeps rates non-negative', () => {
    const forecast = simulateNativeRatesAfterSupply(baseRateInput, '1234.56');

    expect(forecast.supplyAprPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.borrowAprPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.supplyApyPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.borrowApyPercent).toBeGreaterThanOrEqual(0);
  });

  it('returns zero rates when debt is zero', () => {
    const zeroDebtInput: RateCalcInput = {
      ...baseRateInput,
      totalVariableDebt: '0',
    };
    const forecast = simulateNativeRatesAfterSupply(zeroDebtInput, '1000');

    expect(forecast.utilizationRatePercent).toBe(0);
    expect(forecast.supplyAprPercent).toBe(0);
    expect(forecast.borrowAprPercent).toBe(0);
  });
});

describe('simulateNativeRatesAfterBorrow', () => {
  it('increases utilization when borrow amount increases', () => {
    const withoutBorrow = simulateNativeRatesAfterBorrow(baseRateInput, '0');
    const withBorrow = simulateNativeRatesAfterBorrow(baseRateInput, '100000');

    expect(withBorrow.utilizationRatePercent).toBeGreaterThan(withoutBorrow.utilizationRatePercent);
    expect(withBorrow.borrowApyPercent).toBeGreaterThan(withoutBorrow.borrowApyPercent);
  });

  it('keeps rates non-negative', () => {
    const forecast = simulateNativeRatesAfterBorrow(baseRateInput, '1234.56');

    expect(forecast.supplyAprPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.borrowAprPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.supplyApyPercent).toBeGreaterThanOrEqual(0);
    expect(forecast.borrowApyPercent).toBeGreaterThanOrEqual(0);
  });

  it('clamps available liquidity to zero when borrow exceeds available', () => {
    const forecast = simulateNativeRatesAfterBorrow(baseRateInput, '99999999999');

    expect(forecast.utilizationRatePercent).toBeGreaterThan(0);
    expect(forecast.borrowApyPercent).toBeGreaterThan(0);
  });
});

describe('simulateNativeRatesAfterActions', () => {
  it('returns optimalUtilizationPercent from rate input', () => {
    const forecast = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });
    expect(forecast.optimalUtilizationPercent).toBeCloseTo(80, 0);
  });

  it('lets supply input change both supply and borrow side rates', () => {
    const current = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });
    const afterSupply = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '100000', borrowAmount: '0' });

    expect(afterSupply.utilizationRatePercent).toBeLessThan(current.utilizationRatePercent);
    expect(afterSupply.supplyApyPercent).toBeLessThan(current.supplyApyPercent);
    expect(afterSupply.borrowApyPercent).toBeLessThan(current.borrowApyPercent);
  });

  it('lets borrow input change both supply and borrow side rates', () => {
    const current = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });
    const afterBorrow = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '100000' });

    expect(afterBorrow.utilizationRatePercent).toBeGreaterThan(current.utilizationRatePercent);
    expect(afterBorrow.supplyApyPercent).toBeGreaterThan(current.supplyApyPercent);
    expect(afterBorrow.borrowApyPercent).toBeGreaterThan(current.borrowApyPercent);
  });

  it('combines supply and borrow inputs into one utilization state', () => {
    const combined = simulateNativeRatesAfterActions(baseRateInput, {
      supplyAmount: '50000',
      borrowAmount: '20000',
    });
    const onlySupply = simulateNativeRatesAfterActions(baseRateInput, {
      supplyAmount: '50000',
      borrowAmount: '0',
    });
    const onlyBorrow = simulateNativeRatesAfterActions(baseRateInput, {
      supplyAmount: '0',
      borrowAmount: '20000',
    });

    expect(combined.utilizationRatePercent).not.toBe(onlySupply.utilizationRatePercent);
    expect(combined.utilizationRatePercent).not.toBe(onlyBorrow.utilizationRatePercent);
    expect(combined.borrowApyPercent).not.toBe(onlySupply.borrowApyPercent);
    expect(combined.supplyApyPercent).not.toBe(onlyBorrow.supplyApyPercent);
  });
});

describe('totalVariableDebt precision (replaces totalScaledVariableDebt × variableBorrowIndex)', () => {
  // The old API provided totalScaledVariableDebt (raw) and variableBorrowIndex (RAY).
  // The new API provides totalVariableDebt = scaledDebt × index ÷ 1e27, already computed by backend.
  // Verify that using totalVariableDebt directly produces identical results to the old formula.

  it('produces correct utilization for 33.33% utilization (debt=500k, liquidity=1M, 18 decimals)', () => {
    // totalSupply = availableLiquidity + totalVariableDebt = 1M + 500k = 1.5M
    // utilization = 500k / 1.5M = 33.33%
    const result = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });
    expect(result.utilizationRatePercent).toBeCloseTo(33.33, 1);
  });

  it('handles non-trivial borrow index (totalVariableDebt already includes index multiplication)', () => {
    // Simulates a scenario where the old API would have:
    //   totalScaledVariableDebt = 400000000000000000000000 (400k with 18 decimals)
    //   variableBorrowIndex = 1250000000000000000000000000 (1.25 in RAY)
    //   totalVariableDebt = 400k × 1.25 = 500000000000000000000000 (500k)
    // The new API directly gives totalVariableDebt = 500k
    const inputWithIndex: RateCalcInput = {
      ...baseRateInput,
      totalVariableDebt: '500000000000000000000000', // 500k tokens (already index-adjusted)
    };
    const result = simulateNativeRatesAfterActions(inputWithIndex, { supplyAmount: '0', borrowAmount: '0' });
    // utilization = 500k / (1M + 500k) = 33.33%
    expect(result.utilizationRatePercent).toBeCloseTo(33.33, 1);
    expect(result.borrowAprPercent).toBeGreaterThan(0);
    expect(result.supplyAprPercent).toBeGreaterThan(0);
  });

  it('produces consistent results with 6-decimal tokens (USDC-like)', () => {
    const usdcInput: RateCalcInput = {
      ...baseRateInput,
      decimals: 6,
      availableLiquidity: '1000000000000',  // 1M USDC (6 decimals)
      totalVariableDebt: '500000000000',    // 500k USDC
    };
    const result = simulateNativeRatesAfterActions(usdcInput, { supplyAmount: '0', borrowAmount: '0' });
    expect(result.utilizationRatePercent).toBeCloseTo(33.33, 1);
  });

  it('handles very large totalVariableDebt values without precision loss', () => {
    // ~4.5M tokens with 18 decimals
    const largeDebtInput: RateCalcInput = {
      ...baseRateInput,
      availableLiquidity: '5000000000000000000000000',  // 5M
      totalVariableDebt: '4512942554869044630386380',   // ~4.51M (realistic on-chain value)
    };
    const result = simulateNativeRatesAfterActions(largeDebtInput, { supplyAmount: '0', borrowAmount: '0' });
    // utilization ≈ 4.51M / (5M + 4.51M) ≈ 47.4%
    expect(result.utilizationRatePercent).toBeGreaterThan(47);
    expect(result.utilizationRatePercent).toBeLessThan(48);
    expect(result.borrowAprPercent).toBeGreaterThan(0);
    expect(result.supplyAprPercent).toBeGreaterThan(0);
  });
});

describe('deficit impact on rates', () => {
  it('deficit reduces supply APY but does not affect borrow APY or utilization', () => {
    const noDeficit = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });

    const withDeficit: RateCalcInput = {
      ...baseRateInput,
      deficit: '100000000000000000000000', // 100k deficit
    };
    const deficitResult = simulateNativeRatesAfterActions(withDeficit, { supplyAmount: '0', borrowAmount: '0' });

    // Utilization (borrow-side) should be identical — deficit is excluded
    expect(deficitResult.utilizationRatePercent).toBeCloseTo(noDeficit.utilizationRatePercent, 10);
    // Borrow rate should be identical
    expect(deficitResult.borrowAprPercent).toBeCloseTo(noDeficit.borrowAprPercent, 10);
    expect(deficitResult.borrowApyPercent).toBeCloseTo(noDeficit.borrowApyPercent, 10);
    // Supply rate should be lower (diluted by deficit in denominator)
    expect(deficitResult.supplyAprPercent).toBeLessThan(noDeficit.supplyAprPercent);
    expect(deficitResult.supplyApyPercent).toBeLessThan(noDeficit.supplyApyPercent);
  });

  it('zero deficit has no impact on rates', () => {
    const result = simulateNativeRatesAfterActions(
      { ...baseRateInput, deficit: '0' },
      { supplyAmount: '0', borrowAmount: '0' }
    );
    const baseline = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });

    expect(result.supplyApyPercent).toBeCloseTo(baseline.supplyApyPercent, 10);
    expect(result.borrowApyPercent).toBeCloseTo(baseline.borrowApyPercent, 10);
  });
});

describe('baseVariableBorrowRate impact on rates', () => {
  it('non-zero baseVariableBorrowRate raises both borrow and supply rates', () => {
    const zeroBase = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });

    const withBase: RateCalcInput = {
      ...baseRateInput,
      baseVariableBorrowRate: '10000000000000000000000000', // 1% in RAY
    };
    const baseResult = simulateNativeRatesAfterActions(withBase, { supplyAmount: '0', borrowAmount: '0' });

    expect(baseResult.borrowAprPercent).toBeGreaterThan(zeroBase.borrowAprPercent);
    expect(baseResult.supplyAprPercent).toBeGreaterThan(zeroBase.supplyAprPercent);
  });

  it('zero baseVariableBorrowRate is the default behavior', () => {
    const result = simulateNativeRatesAfterActions(
      { ...baseRateInput, baseVariableBorrowRate: '0' },
      { supplyAmount: '0', borrowAmount: '0' }
    );
    const baseline = simulateNativeRatesAfterActions(baseRateInput, { supplyAmount: '0', borrowAmount: '0' });

    expect(result.borrowApyPercent).toBeCloseTo(baseline.borrowApyPercent, 10);
    expect(result.supplyApyPercent).toBeCloseTo(baseline.supplyApyPercent, 10);
  });
});

describe('hasRateCalcFields', () => {
  const fullReserve: ReserveWithSpread = {
    reserveId: 'Core-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    marketName: 'Core',
    chainName: 'Ethereum',
    chainId: 1,
    tokenName: 'USD Coin',
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    availableLiquidity: '1000000000000',
    totalVariableDebt: '500000000000',
    reserveFactor: '1000',
    variableRateSlope1: '40000000000000000000000000',
    variableRateSlope2: '600000000000000000000000000',
    optimalUsageRate: '800000000000000000000000000',
    deficit: '0',
    baseVariableBorrowRate: '0',
  };

  it('returns true when all 9 rate fields are present', () => {
    expect(hasRateCalcFields(fullReserve)).toBe(true);
  });

  it('narrows type so reserve can be passed to simulator', () => {
    if (hasRateCalcFields(fullReserve)) {
      const result = simulateNativeRatesAfterActions(fullReserve, { supplyAmount: '0', borrowAmount: '0' });
      expect(result.utilizationRatePercent).toBeGreaterThan(0);
    }
  });

  const requiredFields = [
    'decimals', 'availableLiquidity', 'totalVariableDebt', 'deficit',
    'reserveFactor', 'variableRateSlope1', 'variableRateSlope2',
    'baseVariableBorrowRate', 'optimalUsageRate',
  ] as const;

  for (const field of requiredFields) {
    it(`returns false when ${field} is missing`, () => {
      const reserve = { ...fullReserve, [field]: undefined };
      expect(hasRateCalcFields(reserve)).toBe(false);
    });
  }
});
