import { describe, expect, it } from 'vitest';
import { getReserveKey } from './reserveKey';

describe('getReserveKey', () => {
  it('returns V3 reserveId as-is', () => {
    expect(
      getReserveKey({ reserveId: 'AaveV3Ethereum:1:0xabc' }),
    ).toBe('AaveV3Ethereum:1:0xabc');
  });

  it('returns V4 reserveId with hubName suffix as-is', () => {
    expect(
      getReserveKey({ reserveId: 'AaveV4Bluechip:1:0xabc:Core' }),
    ).toBe('AaveV4Bluechip:1:0xabc:Core');
  });

  it('trims whitespace from reserveId', () => {
    expect(
      getReserveKey({ reserveId: '  AaveV3Ethereum:1:0xabc  ' }),
    ).toBe('AaveV3Ethereum:1:0xabc');
  });
});
