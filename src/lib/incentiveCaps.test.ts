import { describe, expect, it } from 'vitest';

import {
  buildPositionCapEffect,
  buildMaxRewardCapEffect,
  buildFixRewardCapEffect,
  capEffectToSimulationFields,
  applyPositionCapToForecastResult,
  appendNotes,
  checkForecastAvailability,
} from './incentiveCaps';

describe('capEffectToSimulationFields', () => {
  it('joins note parts and passes warning through', () => {
    const eff = buildFixRewardCapEffect(12.3);
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

  it('carries capMetrics with isCombineCap from position_cap', () => {
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
    const eff = buildMaxRewardCapEffect();
    expect(capEffectToSimulationFields(eff).capMetrics).toBeUndefined();
  });
});

describe('buildPositionCapEffect', () => {
  it('uses combine label when shared', () => {
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

describe('FIX_REWARD and MAX_REWARD cap helpers', () => {
  it('buildFixRewardCapEffect formats days', () => {
    expect(capEffectToSimulationFields(buildFixRewardCapEffect(7)).capNote).toBe('~7d earn');
  });

  it('buildMaxRewardCapEffect is warning', () => {
    expect(capEffectToSimulationFields(buildMaxRewardCapEffect())).toEqual({
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

describe('appendNotes', () => {
  it('returns undefined when all notes are empty', () => {
    expect(appendNotes(undefined, null, null)).toBeUndefined();
  });

  it('returns single note', () => {
    expect(appendNotes('cap note', null, null)).toBe('cap note');
  });

  it('joins note + crossReserveNote with semicolon', () => {
    expect(appendNotes('cap', 'cross', null)).toBe('cap; cross');
  });

  it('joins all three notes with semicolon between cap and offsets', () => {
    expect(appendNotes('cap', 'cross', 'net')).toBe('cap; cross · net');
  });

  it('handles string crossReserveNote', () => {
    expect(appendNotes(undefined, 'cross', null)).toBe('cross');
  });
});

describe('checkForecastAvailability', () => {
  it('returns false when campaignType is undefined', () => {
    expect(checkForecastAvailability(undefined, 'camp-1', null, {})).toBe(false);
  });

  it('returns false when campaignType is empty string', () => {
    expect(checkForecastAvailability('', 'camp-1', null, {})).toBe(false);
  });

  it('returns true when merged is null and campaignType is forecast-requiring', () => {
    expect(checkForecastAvailability('FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE', 'camp-1', null, {})).toBe(true);
  });

  it('returns false when merged has valid forecastState', () => {
    expect(checkForecastAvailability(
      'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
      'camp-1',
      { apr: 5 },
      { 'camp-1': { apr: 5 } },
    )).toBe(false);
  });

  it('returns true for DUTCH_AUCTION when merged is null', () => {
    expect(checkForecastAvailability('DUTCH_AUCTION', 'camp-1', null, {})).toBe(true);
  });

  it('returns false for DUTCH_AUCTION when merged has forecastState', () => {
    expect(checkForecastAvailability(
      'DUTCH_AUCTION',
      'camp-1',
      { apr: 5 },
      { 'camp-1': { apr: 5 } },
    )).toBe(false);
  });
});
