import { describe, expect, it } from 'vitest';

import {
  buildBrevisCalendarEndOnlyEffect,
  buildBrevisPositionCapEffect,
  buildMeritPositionCapEffect,
  buildMerklAprCapEffect,
  buildMerklFixPoolBudgetEffect,
  capEffectToSimulationFields,
} from './incentiveCaps';

describe('capEffectToSimulationFields', () => {
  it('joins note parts and passes warning through', () => {
    const eff = buildMerklFixPoolBudgetEffect(12.3);
    expect(capEffectToSimulationFields(eff)).toEqual({
      capNote: '~12d earn',
      capWarning: false,
      capMetrics: undefined,
    });
  });

  it('carries capMetrics from position_cap effect', () => {
    const eff = buildMeritPositionCapEffect({
      inputUsd: 2000,
      eligibleUsd: 1000,
      positionCapUsd: 1000,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capMetrics).toEqual({ positionCapUsd: 1000 });
  });

  it('carries capMetrics with isSharedSupplyBorrow from Brevis position_cap', () => {
    const eff = buildBrevisPositionCapEffect({
      positionCapUsd: 5000,
      isSharedSupplyBorrow: true,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capMetrics).toEqual({ positionCapUsd: 5000, isSharedSupplyBorrow: true });
  });

  it('returns undefined capMetrics for non-position-cap effects', () => {
    const eff = buildMerklAprCapEffect();
    expect(capEffectToSimulationFields(eff).capMetrics).toBeUndefined();
  });
});

describe('buildMeritPositionCapEffect', () => {
  it('matches simulation copy and warns when input exceeds position cap', () => {
    const under = buildMeritPositionCapEffect({
      inputUsd: 500,
      eligibleUsd: 500,
      positionCapUsd: 1000,
    });
    expect(capEffectToSimulationFields(under)).toEqual({
      capNote: 'Incentive on first $1,000.00',
      capWarning: false,
      capMetrics: { positionCapUsd: 1000 },
    });

    const over = buildMeritPositionCapEffect({
      inputUsd: 2000,
      eligibleUsd: 1000,
      positionCapUsd: 1000,
    });
    expect(capEffectToSimulationFields(over)).toEqual({
      capNote: 'Incentive on first $1,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000 },
    });
  });
});

describe('buildBrevisPositionCapEffect', () => {
  it('uses supply+borrow label when shared', () => {
    const eff = buildBrevisPositionCapEffect({
      positionCapUsd: 5000,
      isSharedSupplyBorrow: true,
      isCapBinding: false,
      remainingBudget: 10000,
      dailyRewardUsd: 100,
      remainingDays: 200,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capNote).toBe(
      'Incentive on first $5,000.00 · supply + borrow · ~100d earn',
    );
    expect(fields.capMetrics).toEqual({ positionCapUsd: 5000, isSharedSupplyBorrow: true });
  });

  it('uses single-side label when not shared', () => {
    const eff = buildBrevisPositionCapEffect({
      positionCapUsd: 5000,
      isSharedSupplyBorrow: false,
      isCapBinding: true,
      remainingBudget: 5000,
      dailyRewardUsd: 100,
      remainingDays: 50,
    });
    const { capNote, capWarning, capMetrics } = capEffectToSimulationFields(eff);
    expect(capNote).toBe('Incentive on first $5,000.00 · ~50d earn');
    expect(capWarning).toBe(true);
    expect(capMetrics).toEqual({ positionCapUsd: 5000 });
  });

  it('falls back to calendar days when no budget data', () => {
    const eff = buildBrevisPositionCapEffect({
      positionCapUsd: 5000,
      isSharedSupplyBorrow: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: 60,
    });
    expect(capEffectToSimulationFields(eff).capNote).toBe('Incentive on first $5,000.00 · ~60d to end');
  });

  it('omits earn segment when neither horizon is positive', () => {
    const eff = buildBrevisPositionCapEffect({
      positionCapUsd: 100,
      isSharedSupplyBorrow: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToSimulationFields(eff).capNote).toBe('Incentive on first $100.00');
  });
});

describe('buildBrevisCalendarEndOnlyEffect', () => {
  it('matches ~Nd to end copy', () => {
    const eff = buildBrevisCalendarEndOnlyEffect(30);
    expect(capEffectToSimulationFields(eff)).toEqual({
      capNote: '~30d to end',
      capWarning: false,
    });
  });
});

describe('Merkl cap helpers', () => {
  it('buildMerklFixPoolBudgetEffect formats days', () => {
    expect(capEffectToSimulationFields(buildMerklFixPoolBudgetEffect(7)).capNote).toBe('~7d earn');
  });

  it('buildMerklAprCapEffect is warning', () => {
    expect(capEffectToSimulationFields(buildMerklAprCapEffect())).toEqual({
      capNote: 'APR capped for low TVL',
      capWarning: true,
    });
  });
});
