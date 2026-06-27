import { describe, it, expect } from 'vitest';
import { simulateNativeRatesAfterActions } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';

describe('V4 Hub simulation integration', () => {
  it('simulation utilization matches on-chain formula when using Hub aggregated borrowed', () => {
    const rateInput: RateCalcInput = {
      decimals: 18,
      liquidity: '6000000000000000000000',
      borrowed: '4000000000000000000000',
      deficit: '0',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 75,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };

    const sim = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '0', borrowAmount: '0' });

    expect(sim.utilizationRatePercent).toBeCloseTo(40, 0);
  });

  it('different supply amounts produce different APY (calculator does not cap)', () => {
    const rateInput: RateCalcInput = {
      decimals: 18,
      liquidity: '10000000000000000000000',
      borrowed: '5000000000000000000000',
      deficit: '0',
      protocolFee: 10,
      slopeBelowOptimal: 4,
      slopeAboveOptimal: 75,
      baseBorrowRate: 0,
      optimalUtilization: 80,
    };

    const sim0 = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '0', borrowAmount: '0' });
    const simLarge = simulateNativeRatesAfterActions(rateInput, { supplyAmount: '5000000000000000000000', borrowAmount: '0' });

    expect(simLarge.utilizationRatePercent).toBeLessThan(sim0.utilizationRatePercent);
    expect(simLarge.supplyApyPercent).toBeLessThan(sim0.supplyApyPercent);
  });
});