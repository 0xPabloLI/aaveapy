import { describe, expect, it } from 'vitest';
import {
  getReserveKey,
  buildReserveMap,
  buildReserveLookupByChainAndToken,
  toChainTokenKey,
  composeReserveId,
} from './reserveKey';
import type { ReserveWithSpread } from '@/types/aave';

describe('getReserveKey', () => {
  it('returns V3 reserveId as-is', () => {
    expect(
      getReserveKey({ reserveId: '1:0x8787:0xA0b8' }),
    ).toBe('1:0x8787:0xA0b8');
  });

  it('returns V4 reserveId with hubName suffix as-is', () => {
    expect(
      getReserveKey({ reserveId: '1:0x8787:0xA0b8:Core' }),
    ).toBe('1:0x8787:0xA0b8:Core');
  });

  it('trims whitespace from reserveId', () => {
    expect(
      getReserveKey({ reserveId: '  1:0x8787:0xA0b8  ' }),
    ).toBe('1:0x8787:0xA0b8');
  });
});

describe('toChainTokenKey', () => {
  it('lowercases tokenAddress', () => {
    expect(toChainTokenKey(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(
      '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });

  it('handles already-lowercased address', () => {
    expect(toChainTokenKey(42161, '0xdead')).toBe('42161:0xdead');
  });
});

describe('buildReserveLookupByChainAndToken', () => {
  const reserves = [
    { chainId: 1, tokenAddress: '0xA0b8', reserveId: '1:0xpool1:0xA0b8' },
    { chainId: 1, tokenAddress: '0xC02a', reserveId: '1:0xpool1:0xC02a' },
    { chainId: 42161, tokenAddress: '0xA0b8', reserveId: '42161:0xpool2:0xA0b8' },
  ] as ReserveWithSpread[];

  it('builds map keyed by chainId:tokenAddress (lowercased)', () => {
    const map = buildReserveLookupByChainAndToken(reserves);
    expect(map.size).toBe(3);
    expect(map.get('1:0xa0b8')?.reserveId).toBe('1:0xpool1:0xA0b8');
    expect(map.get('1:0xc02a')?.reserveId).toBe('1:0xpool1:0xC02a');
    expect(map.get('42161:0xa0b8')?.reserveId).toBe('42161:0xpool2:0xA0b8');
  });

  it('distinguishes same token on different chains', () => {
    const map = buildReserveLookupByChainAndToken(reserves);
    expect(map.get('1:0xa0b8')).not.toBe(map.get('42161:0xa0b8'));
  });

  it('returns undefined for missing key', () => {
    const map = buildReserveLookupByChainAndToken(reserves);
    expect(map.get('999:0xa0b8')).toBeUndefined();
  });

  it('skips reserves without chainId or tokenAddress', () => {
    const incomplete = [
      { reserveId: 'no-chain' },
      { chainId: 1, reserveId: 'no-token' },
    ] as ReserveWithSpread[];
    const map = buildReserveLookupByChainAndToken(incomplete);
    expect(map.size).toBe(0);
  });

  it('keeps first reserve on duplicate key', () => {
    const dup = [
      { chainId: 1, tokenAddress: '0xaaa', tokenSymbol: 'FIRST' },
      { chainId: 1, tokenAddress: '0xaaa', tokenSymbol: 'SECOND' },
    ] as ReserveWithSpread[];
    const map = buildReserveLookupByChainAndToken(dup);
    expect(map.size).toBe(1);
    expect(map.get('1:0xaaa')?.tokenSymbol).toBe('FIRST');
  });
});

describe('buildReserveMap', () => {
  const reserves = [
    { reserveId: '1:0xpool1:0xaaa', tokenAddress: '0xaaa', chainId: 1 },
    { reserveId: '1:0xpool2:0xaaa', tokenAddress: '0xaaa', chainId: 1 },
    { reserveId: '1:0xpool1:0xbbb', tokenAddress: '0xbbb', chainId: 1 },
  ] as ReserveWithSpread[];

  it('builds map keyed by reserveId', () => {
    const map = buildReserveMap(reserves);
    expect(map.size).toBe(3);
    expect(map.get('1:0xpool1:0xaaa')?.tokenAddress).toBe('0xaaa');
    expect(map.get('1:0xpool2:0xaaa')?.tokenAddress).toBe('0xaaa');
    expect(map.get('1:0xpool1:0xbbb')?.tokenAddress).toBe('0xbbb');
  });

  it('returns undefined for missing key', () => {
    const map = buildReserveMap(reserves);
    expect(map.get('nonexistent')).toBeUndefined();
  });

  it('keeps first reserve on duplicate reserveId', () => {
    const dup = [
      { reserveId: '1:0xp:0xaaa', tokenSymbol: 'FIRST' },
      { reserveId: '1:0xp:0xaaa', tokenSymbol: 'SECOND' },
    ] as ReserveWithSpread[];
    const map = buildReserveMap(dup);
    expect(map.size).toBe(1);
    expect(map.get('1:0xp:0xaaa')?.tokenSymbol).toBe('FIRST');
  });

  it('trims whitespace on reserveId keys', () => {
    const spaced = [
      { reserveId: '  1:0xp:0xaaa  ' },
    ] as ReserveWithSpread[];
    const map = buildReserveMap(spaced);
    expect(map.has('1:0xp:0xaaa')).toBe(true);
  });
});

describe('composeReserveId', () => {
  it('composes V3 reserveId: chainId:poolAddress:tokenAddress', () => {
    expect(
      composeReserveId(1, '0x87870Bca3F3fD6b5bB36c0221BCC5C4c1F7C69c6', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
    ).toBe('1:0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
  })

  it('composes V4 reserveId with hubAddress: chainId:poolAddress:tokenAddress:hubAddress', () => {
    expect(
      composeReserveId(1, '0x8787...', '0xA0b8...', '0xCca8A2316a28C583e12c8844d2D4E1f4D8F8D26c9'),
    ).toBe('1:0x8787...:0xa0b8...:0xcca8a2316a28c583e12c8844d2d4e1f4d8f8d26c9')
  })

  it('lowercases all address components including hubAddress', () => {
    const result = composeReserveId(42161, '0xABC', '0xDEF', '0xCca8AbC123')
    expect(result).toBe('42161:0xabc:0xdef:0xcca8abc123')
  })

  it('returns undefined when poolAddress is empty', () => {
    expect(composeReserveId(1, '', '0xA0b8')).toBeUndefined()
  })

  it('returns undefined when tokenAddress is empty', () => {
    expect(composeReserveId(1, '0x8787', '')).toBeUndefined()
  })

  it('returns undefined when chainId is 0', () => {
    expect(composeReserveId(0, '0x8787', '0xA0b8')).toBeUndefined()
  })

  it('returns undefined when chainId is negative', () => {
    expect(composeReserveId(-1, '0x8787', '0xA0b8')).toBeUndefined()
  })

  it('works without hubAddress (V3 format)', () => {
    const result = composeReserveId(137, '0xPool', '0xToken')
    expect(result).toBe('137:0xpool:0xtoken')
    expect(result!.split(':')).toHaveLength(3)
  })

  it('with hubAddress produces 4 colon-separated segments', () => {
    const result = composeReserveId(1, '0xPool', '0xToken', '0xHubAbc')
    expect(result!.split(':')).toHaveLength(4)
  })
})
