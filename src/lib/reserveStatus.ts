import type { ReserveWithSpread } from '@/types/aave';

function hasProtocolRestriction(reserve: ReserveWithSpread): boolean {
  return !!reserve.isPaused || reserve.isActive === false || !!reserve.isFrozen;
}

export function isSupplyDisabled(reserve: ReserveWithSpread): boolean {
  return hasProtocolRestriction(reserve) || reserve.supplyDisabled === true;
}

export function isBorrowDisabled(reserve: ReserveWithSpread): boolean {
  return hasProtocolRestriction(reserve) || reserve.borrowDisabled === true;
}

export function getReserveFlags(reserve: ReserveWithSpread): {
  paused: boolean;
  inactive: boolean;
  frozen: boolean;
} {
  return {
    paused: !!reserve.isPaused,
    inactive: reserve.isActive === false,
    frozen: !!reserve.isFrozen,
  };
}

export function getPrimaryReserveStatus(reserve: ReserveWithSpread): string | null {
  if (reserve.isPaused) return 'paused';
  if (reserve.isActive === false) return 'inactive';
  if (reserve.isFrozen) return 'frozen';
  return null;
}

export function isRestrictedReserve(reserve: ReserveWithSpread): boolean {
  return hasProtocolRestriction(reserve);
}