import { describe, it, expect } from 'vitest';
import { marketKey } from './marketKey';

describe('marketKey', () => {
  it('creates a composite key from chainId and marketName', () => {
    expect(marketKey(1, 'AaveV4Main')).toBe('1:AaveV4Main');
    expect(marketKey(43114, 'AaveV4Main')).toBe('43114:AaveV4Main');
  });

  it('produces different keys for same marketName on different chains', () => {
    const ethKey = marketKey(1, 'AaveV4Main');
    const avaxKey = marketKey(43114, 'AaveV4Main');
    expect(ethKey).not.toBe(avaxKey);
  });

  it('produces same key for same chainId and marketName', () => {
    expect(marketKey(1, 'AaveV3Ethereum')).toBe(marketKey(1, 'AaveV3Ethereum'));
  });
});
