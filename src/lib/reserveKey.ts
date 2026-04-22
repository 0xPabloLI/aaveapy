import type { ReserveWithSpread } from '@/types/aave';

export type ReserveKeySource = Pick<ReserveWithSpread, 'reserveId'>;

/**
 * Returns the canonical reserve key for UI/state lookups.
 *
 * The backend guarantees `reserveId` is globally unique (V4 includes
 * `:hubName` suffix). Frontend treats it as an opaque string.
 */
export const getReserveKey = (reserve: ReserveKeySource): string => {
  return reserve.reserveId.trim();
};
