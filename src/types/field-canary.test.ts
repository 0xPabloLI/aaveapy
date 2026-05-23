import { describe, it, expect } from 'vitest';
import type { ReserveWithSpread, CampaignGroup } from './aave';
import { nativeToUsd, getReserveTotalBorrowedUsd } from '@/lib/scenarioSize';

const mock: ReserveWithSpread = {
  reserveId: 'canary-1',
  marketName: 'Canary',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'Canary Token',
  tokenSymbol: 'CNY',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 2,
  decimals: 6,
  supplied: '2000000000000',
  borrowed: '500000000000',
  supplyCap: '3000000000000',
  borrowCap: '1000000000000',
  optimalUtilization: 90,
  isFrozen: false,
  isPaused: false,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyApy: 4.5,
  borrowApy: 6.0,
  utilizationPct: 45,
  hubId: 'hub-core',
  hubName: 'Core',
};

describe('ReserveWithSpread canonical field-name canary', () => {
  it('nativeToUsd(reserve.supplied) produces valid non-null USD', () => {
    const usd = nativeToUsd(mock.supplied, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(4_000_000);
  });

  it('getReserveTotalBorrowedUsd(reserve.borrowed) produces valid USD', () => {
    const usd = getReserveTotalBorrowedUsd(mock);
    expect(usd).toBe(1_000_000);
  });

  it('nativeToUsd(reserve.supplyCap) produces valid USD', () => {
    const usd = nativeToUsd(mock.supplyCap, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(6_000_000);
  });

  it('nativeToUsd(reserve.borrowCap) produces valid USD', () => {
    const usd = nativeToUsd(mock.borrowCap, mock.decimals, mock.tokenPrice);
    expect(usd).toBe(2_000_000);
  });

  it('reserve.hubId is a string (used in filter callback)', () => {
    expect(typeof mock.hubId).toBe('string');
    expect(mock.hubId).toBe('hub-core');
  });

  it('reserve.optimalUtilization is a number (used in UtilizationIndicator)', () => {
    expect(typeof mock.optimalUtilization).toBe('number');
    expect(mock.optimalUtilization).toBe(90);
  });

  it('reserve.isFrozen and reserve.isPaused are booleans', () => {
    expect(typeof mock.isFrozen).toBe('boolean');
    expect(typeof mock.isPaused).toBe('boolean');
  });

  it('reserve.supplyDisabled and reserve.borrowDisabled are booleans', () => {
    expect(typeof mock.supplyDisabled).toBe('boolean');
    expect(typeof mock.borrowDisabled).toBe('boolean');
  });

  it('reserve.supplyApy and reserve.borrowApy are numbers', () => {
    expect(typeof mock.supplyApy).toBe('number');
    expect(typeof mock.borrowApy).toBe('number');
  });
});

describe('CampaignGroup netPositionConstraint field-name canary', () => {
  const group: CampaignGroup = {
    link: 'https://merkl.xyz',
    breakdowns: [],
    opportunityType: 'AAVE_NET_LENDING',
    netPositionConstraint: {
      sourceSide: 'supply',
      offsetReserveIds: ['1:0xPool:0xUsde', '1:0xPool:0xGho'],
    },
  };

  it('group.opportunityType is an optional string', () => {
    expect(typeof group.opportunityType).toBe('string');
    expect(group.opportunityType).toBe('AAVE_NET_LENDING');
  });

  it('group.netPositionConstraint.sourceSide is supply or borrow', () => {
    expect(['supply', 'borrow']).toContain(group.netPositionConstraint!.sourceSide);
  });

  it('group.netPositionConstraint.offsetReserveIds is string[]', () => {
    expect(Array.isArray(group.netPositionConstraint!.offsetReserveIds)).toBe(true);
    group.netPositionConstraint!.offsetReserveIds.forEach(id => {
      expect(typeof id).toBe('string');
    });
  });

  it('group without netPositionConstraint is valid (optional)', () => {
    const plain: CampaignGroup = { link: 'https://merkl.xyz', breakdowns: [] };
    expect(plain.netPositionConstraint).toBeUndefined();
  });
});