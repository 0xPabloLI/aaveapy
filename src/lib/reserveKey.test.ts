import { describe, expect, it } from 'vitest';
import { getReserveKey } from './reserveKey';

describe('getReserveKey', () => {
  it('prefers the backend reserveId when present', () => {
    expect(
      getReserveKey({
        reserveId: 'AaveV3Ethereum-0xabc',
      }),
    ).toBe('AaveV3Ethereum-0xabc');
  });

});
