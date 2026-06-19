import { describe, expect, it } from 'vitest';

import {
  buildCalendarEndEffect,
  buildPositionCapEffect,
  buildAprCapEffect,
  buildPoolBudgetEffect,
  capEffectToSimulationFields,
  applyPositionCapToForecastResult,
} from './incentiveCaps';

describe('capEffectToSimulationFields', () => {
  it('joins note parts and passes warning through', () => {
    const eff = buildPoolBudgetEffect(12.3);
    expect(capEffectToSimulationFields(eff)).toEqual({
      capNote: '~12d earn',
      capWarning: false,
      capMetrics: undefined,
    });
  });

  it('carries capMetrics from position_cap effect', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      isCombineCap: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capMetrics).toEqual({ positionCapUsd: 1000 });
  });

  it('carries capMetrics with isCombineCap from Brevis position_cap', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 5000,
      isCombineCap: true,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capMetrics).toEqual({ positionCapUsd: 5000, isCombineCap: true });
  });

  it('returns undefined capMetrics for non-position-cap effects', () => {
    const eff = buildAprCapEffect();
    expect(capEffectToSimulationFields(eff).capMetrics).toBeUndefined();
  });
});

describe('buildPositionCapEffect', () => {
  it('uses supply+borrow label when shared', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 5000,
      isCombineCap: true,
      isCapBinding: false,
      remainingBudget: 10000,
      dailyRewardUsd: 100,
      remainingDays: 200,
    });
    const fields = capEffectToSimulationFields(eff);
    expect(fields.capNote).toBe(
      'Incentive on first $5,000.00 · combine · ~100d earn',
    );
    expect(fields.capMetrics).toEqual({ positionCapUsd: 5000, isCombineCap: true });
  });

  it('uses single-side label when not shared', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 5000,
      isCombineCap: false,
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
    const eff = buildPositionCapEffect({
      positionCapUsd: 5000,
      isCombineCap: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: 60,
    });
    expect(capEffectToSimulationFields(eff).capNote).toBe('Incentive on first $5,000.00 · ~60d to end');
  });

  it('omits earn segment when neither horizon is positive', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 100,
      isCombineCap: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToSimulationFields(eff).capNote).toBe('Incentive on first $100.00');
  });
});

describe('buildCalendarEndEffect', () => {
  it('matches ~Nd to end copy', () => {
    const eff = buildCalendarEndEffect(30);
    expect(capEffectToSimulationFields(eff)).toEqual({
      capNote: '~30d to end',
      capWarning: false,
    });
  });
});

describe('Pool budget and APR cap helpers', () => {
  it('buildPoolBudgetEffect formats days', () => {
    expect(capEffectToSimulationFields(buildPoolBudgetEffect(7)).capNote).toBe('~7d earn');
  });

  it('buildAprCapEffect is warning', () => {
    expect(capEffectToSimulationFields(buildAprCapEffect())).toEqual({
      capNote: 'APR capped for low TVL',
      capWarning: true,
    });
  });
});

describe('applyPositionCapToForecastResult', () => {
  it('returns unscaled APR when capUsd is undefined', () => {
    const result = applyPositionCapToForecastResult(10, 5000, undefined);
    expect(result.aprPercent).toBe(10);
    expect(result.capNote).toBeUndefined();
    expect(result.capWarning).toBe(false);
  });

  it('returns unscaled APR when capUsd is 0', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 0);
    expect(result.aprPercent).toBe(10);
    expect(result.capNote).toBeUndefined();
    expect(result.capWarning).toBe(false);
  });

  it('scales APR and generates capNote when position exceeds cap', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 1000);
    expect(result.aprPercent).toBeCloseTo(2, 6);
    expect(result.capNote).toBeDefined();
    expect(result.capWarning).toBe(true);
    expect(result.capMetrics?.positionCapUsd).toBe(1000);
  });

  it('generates capNote but no capWarning when position is below cap', () => {
    const result = applyPositionCapToForecastResult(10, 500, 1000);
    expect(result.aprPercent).toBe(10);
    expect(result.capNote).toBeDefined();
    expect(result.capWarning).toBe(false);
  });

  it('includes isCombineCap in capMetrics', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 1000, {
      isCombineCap: true,
    });
    expect(result.capMetrics?.isCombineCap).toBe(true);
  });
});
