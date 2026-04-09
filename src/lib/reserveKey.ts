import type { ReserveWithSpread } from '@/types/aave';

export type ReserveKeySource = Pick<ReserveWithSpread, 'reserveId'>;

/**
 * Returns the canonical reserve key for UI/state lookups.
 */
export const getReserveKey = (reserve: ReserveKeySource): string => {
  return reserve.reserveId.trim();
};
