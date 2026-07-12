import { describe, expect, it } from 'vitest';

import {
  buildPositionCapEffect,
  buildMaxRewardCapEffect,
  buildFixRewardCapEffect,
  capEffectToNote,
  netEligibleToNote,
  applyPositionCapToForecastResult,
  checkForecastAvailability,
} from './incentiveCaps';

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
    const note = capEffectToNote(eff);
    expect(note.text).toBe(
      'Incentive limited to first $5,000.00 · combined supply + borrow · ~100d earn',
    );
    expect(note.color).toBe('muted');
    expect(eff.metrics).toEqual({ positionCapUsd: 5000, isCombineCap: true, remainingDays: 200 });
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
    const note = capEffectToNote(eff);
    expect(note.text).toBe('Incentive limited to first $5,000.00 · ~50d earn');
    expect(note.color).toBe('amber');
    expect(eff.metrics).toEqual({ positionCapUsd: 5000, remainingDays: 50 });
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
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $5,000.00 · ~60d to end');
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
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $100.00');
  });

  it('uses native token amount when positionCapNative + tokenSymbol + decimals are provided', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      positionCapNative: '1000000000',
      tokenSymbol: 'USDT',
      decimals: 6,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first 1,000.00 USDT');
  });

  it('uses native token amount with 18 decimals', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 50000,
      positionCapNative: '20150000000000000000',
      tokenSymbol: 'WETH',
      decimals: 18,
      isCombineCap: false,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first 20.15 WETH');
  });

  it('appends combine label after native amount', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 5000,
      positionCapNative: '5000000000',
      tokenSymbol: 'USDT',
      decimals: 6,
      isCombineCap: true,
      isCapBinding: false,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe(
      'Incentive limited to first 5,000.00 USDT · combined supply + borrow',
    );
  });

  it('falls back to USD when positionCapNative is absent', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $1,000.00');
  });

  it('falls back to USD when tokenSymbol is absent but positionCapNative is present', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      positionCapNative: '1000000000',
      decimals: 6,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $1,000.00');
  });

  it('falls back to USD when positionCapNative is an invalid string', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      positionCapNative: 'not-a-number',
      tokenSymbol: 'USDT',
      decimals: 6,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $1,000.00');
  });

  it('falls back to USD when positionCapNative is zero', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      positionCapNative: '0',
      tokenSymbol: 'USDT',
      decimals: 6,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    expect(capEffectToNote(eff).text).toBe('Incentive limited to first $1,000.00');
  });
});

describe('FIX_REWARD and MAX_REWARD cap helpers', () => {
  it('buildFixRewardCapEffect formats days', () => {
    expect(capEffectToNote(buildFixRewardCapEffect(7)).text).toBe('~7d earn');
  });

  it('buildMaxRewardCapEffect is warning', () => {
    const note = capEffectToNote(buildMaxRewardCapEffect());
    expect(note).toEqual({
      type: 'apr_cap',
      text: 'APR capped for low TVL',
      color: 'amber',
    });
  });
});

describe('applyPositionCapToForecastResult', () => {
  it('returns unscaled APR when capUsd is undefined', () => {
    const result = applyPositionCapToForecastResult(10, 5000, undefined);
    expect(result.aprPercent).toBe(10);
    expect(result.notes).toBeUndefined();
  });

  it('returns unscaled APR when capUsd is 0', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 0);
    expect(result.aprPercent).toBe(10);
    expect(result.notes).toBeUndefined();
  });

  it('scales APR and generates notes when position exceeds cap', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 1000);
    expect(result.aprPercent).toBeCloseTo(2, 6);
    expect(result.notes).toHaveLength(1);
    expect(result.notes?.[0]?.color).toBe('amber');
    expect(result.capMetrics?.positionCapUsd).toBe(1000);
  });

  it('generates notes with muted color when position is below cap', () => {
    const result = applyPositionCapToForecastResult(10, 500, 1000);
    expect(result.aprPercent).toBe(10);
    expect(result.notes).toHaveLength(1);
    expect(result.notes?.[0]?.color).toBe('muted');
  });

  it('includes isCombineCap in capMetrics', () => {
    const result = applyPositionCapToForecastResult(10, 5000, 1000, {
      isCombineCap: true,
    });
    expect(result.capMetrics?.isCombineCap).toBe(true);
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

describe('capEffectToNote', () => {
  it('converts position_cap effect to IncentiveNote', () => {
    const eff = buildPositionCapEffect({
      positionCapUsd: 1000,
      isCombineCap: false,
      isCapBinding: true,
      remainingBudget: null,
      dailyRewardUsd: null,
      remainingDays: null,
    });
    const note = capEffectToNote(eff);
    expect(note).toEqual({
      type: 'position_cap',
      text: expect.stringContaining('Incentive limited to first'),
      color: 'amber',
    });
  });

  it('converts pool_budget effect with muted color', () => {
    const eff = buildFixRewardCapEffect(30);
    const note = capEffectToNote(eff);
    expect(note).toEqual({ type: 'pool_budget', text: '~30d earn', color: 'muted' });
  });

  it('converts apr_cap effect with amber color', () => {
    const eff = buildMaxRewardCapEffect();
    const note = capEffectToNote(eff);
    expect(note).toEqual({ type: 'apr_cap', text: 'APR capped for low TVL', color: 'amber' });
  });

});

describe('netEligibleToNote', () => {
  it('creates net_eligible note with muted color', () => {
    const note = netEligibleToNote('$500 of $1,000 net eligible');
    expect(note).toEqual({
      type: 'net_eligible',
      text: '$500 of $1,000 net eligible',
      color: 'muted',
    });
  });
});
