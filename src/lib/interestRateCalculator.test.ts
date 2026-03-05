import { describe, expect, it } from 'vitest';
import type { ReserveRateInput } from '@/types/aave';
import { simulateNativeRatesAfterSupply, simulateNativeRatesAfterBorrow } from '@/lib/interestRateCalculator';

const baseRateInput: ReserveRateInput = {
  chainId: 1,
  tokenAddress: '0x0000000000000000000000000000000000000001',
  decimals: 18,
  availableLiquidity: '1000000000000000000000000',
  totalScaledVariableDebt: '500000000000000000000000',
  variableBorrowIndex: '1000000000000000000000000000',
  reserveFactor: '1000',
  variableRateSlope1: '40000000000000000000000000',
  variableRateSlope2: '600000000000000000000000000',
  baseVariableBorrowRate: '0',
  optimalUsageRate: '800000000000000000000000000',
  source: 'subgraph',
  sourceDetail: 'id/test',
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
    const zeroDebtInput: ReserveRateInput = {
      ...baseRateInput,
      totalScaledVariableDebt: '0',
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

