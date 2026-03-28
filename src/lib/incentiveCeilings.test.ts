import { describe, expect, it } from 'vitest';

import {
  buildBrevisCalendarEndOnlyEffect,
  buildBrevisRewardCeilingEffect,
  buildMeritSelfDepositCeilingEffect,
  buildMerklAprCeilingEffect,
  buildMerklFixPoolBudgetEffect,
  ceilingEffectToSimulationFields,
} from './incentiveCeilings';

describe('ceilingEffectToSimulationFields', () => {
  it('joins note parts and passes warning through', () => {
    const eff = buildMerklFixPoolBudgetEffect(12.3);
    expect(ceilingEffectToSimulationFields(eff)).toEqual({
      capNote: '~12d earn',
      capWarning: false,
    });
  });
});

describe('buildMeritSelfDepositCeilingEffect', () => {
  it('matches simulation copy and warns when input exceeds deposit ceiling', () => {
    const under = buildMeritSelfDepositCeilingEffect({
      inputUsd: 500,
      selfEligibleUsd: 500,
      depositCeilingUsd: 1000,
    });
    expect(ceilingEffectToSimulationFields(under)).toEqual({
      capNote: 'Eligible supply capped at $1,000.00',
      capWarning: false,
    });

    const over = buildMeritSelfDepositCeilingEffect({
      inputUsd: 2000,
      selfEligibleUsd: 1000,
      depositCeilingUsd: 1000,
    });
    expect(ceilingEffectToSimulationFields(over)).toEqual({
      capNote: 'Eligible supply capped at $1,000.00',
      capWarning: true,
    });
  });
});

describe('buildBrevisRewardCeilingEffect', () => {
  it('uses supply+borrow label when shared', () => {
    const eff = buildBrevisRewardCeilingEffect({
      rewardCeilingUsd: 5000,
      isSharedSupplyBorrow: true,
      isCapBinding: false,
      daysToHitCap: 100,
      remainingDays: null,
    });
    expect(ceilingEffectToSimulationFields(eff).capNote).toBe(
      'Reward capped at $5,000.00/user · supply + borrow · ~100d earn',
    );
  });

  it('uses single-side label when not shared', () => {
    const eff = buildBrevisRewardCeilingEffect({
      rewardCeilingUsd: 5000,
      isSharedSupplyBorrow: false,
      isCapBinding: true,
      daysToHitCap: 200,
      remainingDays: 50,
    });
    const { capNote, capWarning } = ceilingEffectToSimulationFields(eff);
    expect(capNote).toBe('Reward capped at $5,000.00/user · ~50d earn');
    expect(capWarning).toBe(true);
  });

  it('omits earn segment when neither horizon is positive', () => {
    const eff = buildBrevisRewardCeilingEffect({
      rewardCeilingUsd: 100,
      isSharedSupplyBorrow: false,
      isCapBinding: false,
      daysToHitCap: null,
      remainingDays: null,
    });
    expect(ceilingEffectToSimulationFields(eff).capNote).toBe('Reward capped at $100.00/user');
  });
});

describe('buildBrevisCalendarEndOnlyEffect', () => {
  it('matches ~Nd to end copy', () => {
    const eff = buildBrevisCalendarEndOnlyEffect(30);
    expect(ceilingEffectToSimulationFields(eff)).toEqual({
      capNote: '~30d to end',
      capWarning: false,
    });
  });
});

describe('Merkl ceiling helpers', () => {
  it('buildMerklFixPoolBudgetEffect formats days', () => {
    expect(ceilingEffectToSimulationFields(buildMerklFixPoolBudgetEffect(7)).capNote).toBe('~7d earn');
  });

  it('buildMerklAprCeilingEffect is warning', () => {
    expect(ceilingEffectToSimulationFields(buildMerklAprCeilingEffect())).toEqual({
      capNote: 'APR capped for low TVL',
      capWarning: true,
    });
  });
});
