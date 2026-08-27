import { describe, expect, it } from 'vitest';
import { isSupplyDisabled, isBorrowDisabled, getPrimaryReserveStatus, isRestrictedReserve, getReserveFlags } from './reserveStatus';
import type { ReserveWithSpread } from '@/types/aave';

const BASE_RESERVE: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0x0001',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'Test Token',
  tokenSymbol: 'TEST',
  tokenAddress: '0x0001',
};

describe('hasProtocolRestriction (internal via isSupplyDisabled)', () => {
  it('frozen reserve → supply/borrow disabled, no supplyDisabled/borrowDisabled field needed', () => {
    const r = { ...BASE_RESERVE, isFrozen: true };
    expect(isSupplyDisabled(r)).toBe(true);
    expect(isBorrowDisabled(r)).toBe(true);
  });

  it('paused reserve → supply/borrow disabled', () => {
    const r = { ...BASE_RESERVE, isPaused: true };
    expect(isSupplyDisabled(r)).toBe(true);
    expect(isBorrowDisabled(r)).toBe(true);
  });

  it('inactive reserve (isActive=false) → supply/borrow disabled', () => {
    const r = { ...BASE_RESERVE, isActive: false as const };
    expect(isSupplyDisabled(r)).toBe(true);
    expect(isBorrowDisabled(r)).toBe(true);
  });

  it('frozen + paused → both protocol reasons, supply/borrow disabled', () => {
    const r = { ...BASE_RESERVE, isFrozen: true, isPaused: true };
    expect(isSupplyDisabled(r)).toBe(true);
    expect(isBorrowDisabled(r)).toBe(true);
  });

  it('normal reserve → falls back to supplyDisabled/borrowDisabled field', () => {
    const normal = { ...BASE_RESERVE };
    expect(isSupplyDisabled(normal)).toBe(false);
    expect(isBorrowDisabled(normal)).toBe(false);

    const supplyOnly = { ...BASE_RESERVE, supplyDisabled: true };
    expect(isSupplyDisabled(supplyOnly)).toBe(true);
    expect(isBorrowDisabled(supplyOnly)).toBe(false);

    const borrowOnly = { ...BASE_RESERVE, borrowDisabled: true };
    expect(isSupplyDisabled(borrowOnly)).toBe(false);
    expect(isBorrowDisabled(borrowOnly)).toBe(true);
  });
});

describe('getPrimaryReserveStatus', () => {
  it('paused wins over everything', () => {
    expect(getPrimaryReserveStatus({ ...BASE_RESERVE, isPaused: true, isFrozen: true, isActive: false as const } as ReserveWithSpread))
      .toBe('paused');
  });

  it('inactive wins over frozen', () => {
    expect(getPrimaryReserveStatus({ ...BASE_RESERVE, isActive: false, isFrozen: true } as ReserveWithSpread))
      .toBe('inactive');
  });

  it('frozen → frozen', () => {
    expect(getPrimaryReserveStatus({ ...BASE_RESERVE, isFrozen: true } as ReserveWithSpread))
      .toBe('frozen');
  });

  it('normal → null', () => {
    expect(getPrimaryReserveStatus({ ...BASE_RESERVE } as ReserveWithSpread)).toBeNull();
  });

  it('supplyDisabled only (no protocol reason) → null', () => {
    expect(getPrimaryReserveStatus({ ...BASE_RESERVE, supplyDisabled: true } as ReserveWithSpread)).toBeNull();
  });
});

describe('getReserveFlags', () => {
  it('parses paused', () => {
    const flags = getReserveFlags({ ...BASE_RESERVE, isPaused: true } as ReserveWithSpread);
    expect(flags).toEqual({ paused: true, inactive: false, frozen: false });
  });

  it('parses frozen', () => {
    const flags = getReserveFlags({ ...BASE_RESERVE, isFrozen: true } as ReserveWithSpread);
    expect(flags).toEqual({ paused: false, inactive: false, frozen: true });
  });

  it('parses inactive (isActive=false)', () => {
    const flags = getReserveFlags({ ...BASE_RESERVE, isActive: false as const } as ReserveWithSpread);
    expect(flags).toEqual({ paused: false, inactive: true, frozen: false });
  });

  it('parses paused+frozen', () => {
    const flags = getReserveFlags({ ...BASE_RESERVE, isPaused: true, isFrozen: true } as ReserveWithSpread);
    expect(flags).toEqual({ paused: true, inactive: false, frozen: true });
  });

  it('normal reserve → all false', () => {
    const flags = getReserveFlags({ ...BASE_RESERVE } as ReserveWithSpread);
    expect(flags).toEqual({ paused: false, inactive: false, frozen: false });
  });
});

describe('isRestrictedReserve', () => {
  it('true for frozen', () => {
    expect(isRestrictedReserve({ ...BASE_RESERVE, isFrozen: true } as ReserveWithSpread)).toBe(true);
  });
  it('true for paused', () => {
    expect(isRestrictedReserve({ ...BASE_RESERVE, isPaused: true } as ReserveWithSpread)).toBe(true);
  });
  it('true for inactive', () => {
    expect(isRestrictedReserve({ ...BASE_RESERVE, isActive: false as const } as ReserveWithSpread)).toBe(true);
  });
  it('false for normal', () => {
    expect(isRestrictedReserve({ ...BASE_RESERVE } as ReserveWithSpread)).toBe(false);
  });
  it('false for supplyDisabled only', () => {
    expect(isRestrictedReserve({ ...BASE_RESERVE, supplyDisabled: true } as ReserveWithSpread)).toBe(false);
  });
});