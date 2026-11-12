import { describe, it, expect } from 'vitest';
import { deriveV3AssetsByMarket, deriveV4ReservesBySpoke, decodeV4ReserveId } from './deriveOnchainConfig';
import type { ReserveWithSpread } from '@/types/aave';

const makeV3Reserve = (
  chainId: number,
  tokenAddress: string,
  overrides?: Partial<ReserveWithSpread> & { poolAddress?: string },
): ReserveWithSpread =>
  ({
    reserveId: `${chainId}:${overrides?.poolAddress ?? '0xpool'}:${tokenAddress}`,
    marketName: `AaveV3Chain${chainId}`,
    chainName: 'Test',
    chainId,
    tokenName: 'Token',
    tokenSymbol: 'TKN',
    tokenAddress,
    ...overrides,
  }) as ReserveWithSpread;

// Real shapes: aave-address-book 4.76.1 + production /markets (2026-11-12).
// The API's `spokeName` is a display name ("Main"); the address book's raw key is a
// constant name ("MAIN_SPOKE"). Only `reserveId` relates the two, and the real payload
// leaves `spokeAddress` undefined (`enrichReservesFromId` fills it later, and only when
// the reserveId carries a hub segment). This fixture used to pass the raw key as
// `spokeName`, which is exactly the wrong assumption that hid AAV-1356.
const SPOKES = {
  main: { name: 'Main', address: '0x94e7A5dCbE816e498b89aB752661904E2F56c485' },
  bluechip: { name: 'Bluechip', address: '0x973a023A77420ba610f06b3858aD991Df6d85A08' },
  // Chain 1 really carries two spokes named "Bluechip" (AaveV4Ethereum and
  // AaveV4EthereumSentoraCurated) at different addresses.
  bluechipSentora: { name: 'Bluechip', address: '0xA37e7cdC557f3C7f745FB3F337b6439979662c46' },
  forex: { name: 'Forex', address: '0xD8B93635b8C6d0fF98CbE90b5988E3F2d1Cd9da1' },
} as const;

/** The join key both the producer and the consumer must agree on. */
const keyOf = (spoke: { address: string }) => spoke.address.toLowerCase();

const encode = (decoded: string) => Buffer.from(decoded).toString('base64');

const makeV4Reserve = (
  chainId: number,
  tokenAddress: string,
  spoke: { name: string; address: string },
  aaveProReserveId: string,
  overrides?: Partial<ReserveWithSpread>,
): ReserveWithSpread =>
  ({
    reserveId: `${chainId}:${keyOf(spoke)}:${tokenAddress}:0xhub`,
    marketName: `AaveV4Hub${chainId}`,
    chainName: 'Ethereum',
    chainId,
    tokenName: 'Token',
    tokenSymbol: 'TKN',
    tokenAddress,
    spokeName: spoke.name,
    aaveProReserveId,
    ...overrides,
  }) as ReserveWithSpread;

describe('decodeV4ReserveId', () => {
  it('decodes a base64-encoded aaveProReserveId to bigint', () => {
    const encoded = Buffer.from('1::0xCCa2aAa39b223FE8D0A0e5C4F27eAD9083C756Cc2').toString('base64');
    expect(decodeV4ReserveId(encoded)).toBe(1n);
  });

  it('decodes reserveId 2', () => {
    const encoded = Buffer.from('2::0xdAC17F958D2ee523a2206206994597C13D831ec7').toString('base64');
    expect(decodeV4ReserveId(encoded)).toBe(2n);
  });

  it('returns null for undefined input', () => {
    expect(decodeV4ReserveId(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeV4ReserveId('')).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(decodeV4ReserveId('not-valid!!!')).toBeNull();
  });

  it('returns null for decoded string without :: separator', () => {
    const encoded = Buffer.from('no-separator-here').toString('base64');
    expect(decodeV4ReserveId(encoded)).toBeNull();
  });

  it('returns null for non-numeric reserveId part', () => {
    const encoded = Buffer.from('abc::0x1234').toString('base64');
    expect(decodeV4ReserveId(encoded)).toBeNull();
  });
});

describe('deriveV3AssetsByMarket', () => {
  it('groups V3 token addresses by marketName', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa', { marketName: 'AaveV3Ethereum' }),
      makeV3Reserve(1, '0xBb', { marketName: 'AaveV3Ethereum' }),
      makeV3Reserve(1, '0xCc', { marketName: 'AaveV3EthereumLido' }),
    ];
    const result = deriveV3AssetsByMarket(reserves);
    expect(result['AaveV3Ethereum']).toEqual({ chainId: 1, assets: ['0xAa', '0xBb'] });
    expect(result['AaveV3EthereumLido']).toEqual({ chainId: 1, assets: ['0xCc'] });
  });

  it('separates same chainId but different marketNames', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa', { marketName: 'AaveV3Ethereum' }),
      makeV3Reserve(1, '0xAa', { marketName: 'AaveV3EthereumLido' }),
    ];
    const result = deriveV3AssetsByMarket(reserves);
    expect(Object.keys(result).sort()).toEqual(['AaveV3Ethereum', 'AaveV3EthereumLido']);
  });

  it('excludes V4 reserves (AaveV4* marketName)', () => {
    const reserves = [makeV3Reserve(1, '0xAa'), makeV4Reserve(1, '0xBb', SPOKES.main, 'encoded')];
    const result = deriveV3AssetsByMarket(reserves);
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('returns empty record for empty reserves', () => {
    expect(deriveV3AssetsByMarket([])).toEqual({});
  });

  it('deduplicates token addresses within a market', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa', { marketName: 'AaveV3Ethereum' }),
      makeV3Reserve(1, '0xAa', { marketName: 'AaveV3Ethereum' }),
    ];
    const result = deriveV3AssetsByMarket(reserves);
    expect(result['AaveV3Ethereum'].assets).toEqual(['0xAa']);
  });
});

describe('deriveV4ReservesBySpoke', () => {
  // AAV-1356: the consumer (getV4UserPositionsAllSpokes) looks spokes up by the address
  // book's address, so keying by the API's display name joined nothing and the V4
  // on-chain fallback queried zero spokes on every chain.
  it('keys by the spoke address, not by the API display name', () => {
    const result = deriveV4ReservesBySpoke([makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'))]);
    expect(Object.keys(result)).toEqual([keyOf(SPOKES.main)]);
    expect(result[keyOf(SPOKES.main)]).toEqual([{ reserveId: 1n, asset: '0xAa' }]);
  });

  it('does not key by the display name or the address book raw key', () => {
    const result = deriveV4ReservesBySpoke([makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'))]);
    expect(result['Main']).toBeUndefined();
    expect(result['MAIN_SPOKE']).toBeUndefined();
  });

  it('groups multiple reserves of one spoke', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'), { hubName: 'Core' }),
      makeV4Reserve(1, '0xBb', SPOKES.main, encode('2::0xBb'), { hubName: 'Core' }),
    ];
    const result = deriveV4ReservesBySpoke(reserves);
    expect(Object.keys(result)).toEqual([keyOf(SPOKES.main)]);
    expect(result[keyOf(SPOKES.main)]).toHaveLength(2);
    expect(result[keyOf(SPOKES.main)][0]).toEqual({ reserveId: 1n, asset: '0xAa' });
    expect(result[keyOf(SPOKES.main)][1]).toEqual({ reserveId: 2n, asset: '0xBb' });
  });

  it('separates reserves from different spokes', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa')),
      makeV4Reserve(1, '0xBb', SPOKES.forex, encode('2::0xBb')),
    ];
    const result = deriveV4ReservesBySpoke(reserves);
    expect(Object.keys(result).sort()).toEqual([keyOf(SPOKES.forex), keyOf(SPOKES.main)].sort());
  });

  it('keeps two spokes that share a display name apart', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.bluechip, encode('1::0xAa')),
      makeV4Reserve(1, '0xBb', SPOKES.bluechipSentora, encode('2::0xBb')),
    ];
    const result = deriveV4ReservesBySpoke(reserves);
    expect(Object.keys(result).sort()).toEqual([keyOf(SPOKES.bluechip), keyOf(SPOKES.bluechipSentora)].sort());
    expect(result[keyOf(SPOKES.bluechip)]).toEqual([{ reserveId: 1n, asset: '0xAa' }]);
    expect(result[keyOf(SPOKES.bluechipSentora)]).toEqual([{ reserveId: 2n, asset: '0xBb' }]);
  });

  it('normalises the EIP-55 and lowercase spellings of one address to a single key', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa')),
      makeV4Reserve(1, '0xBb', { name: SPOKES.main.name, address: keyOf(SPOKES.main) }, encode('2::0xBb')),
    ];
    const result = deriveV4ReservesBySpoke(reserves);
    expect(Object.keys(result)).toEqual([keyOf(SPOKES.main)]);
    expect(result[keyOf(SPOKES.main)]).toHaveLength(2);
  });

  // The real payload has this shape on all 124 V4 reserves: the address lives only in
  // reserveId, and `spokeAddress` stays undefined. Reading the property instead would
  // depend on enrichReservesFromId having run first.
  it('keys from reserveId without relying on a spokenAddress property', () => {
    const reserve = makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'));
    expect(reserve.spokeAddress).toBeUndefined();
    expect(Object.keys(deriveV4ReservesBySpoke([reserve]))).toEqual([keyOf(SPOKES.main)]);
  });

  it('keys a 3-segment reserveId (no hub) — enrichReservesFromId leaves spokeAddress unset there', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'), { reserveId: `1:${keyOf(SPOKES.main)}:0xAa` }),
    ];
    expect(Object.keys(deriveV4ReservesBySpoke(reserves))).toEqual([keyOf(SPOKES.main)]);
  });

  it('skips a reserveId whose spoke segment is not an address', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'), { reserveId: '1:MAIN_SPOKE:0xAa:0xhub' }),
    ];
    expect(Object.keys(deriveV4ReservesBySpoke(reserves))).toHaveLength(0);
  });

  it('skips an unparseable reserveId', () => {
    const reserves = [makeV4Reserve(1, '0xAa', SPOKES.main, encode('1::0xAa'), { reserveId: 'not-a-reserve-id' })];
    expect(Object.keys(deriveV4ReservesBySpoke(reserves))).toHaveLength(0);
  });

  it('excludes V3 reserves', () => {
    const reserves = [makeV3Reserve(1, '0xAa'), makeV4Reserve(1, '0xBb', SPOKES.main, encode('1::0xBb'))];
    const result = deriveV4ReservesBySpoke(reserves);
    expect(Object.keys(result)).toEqual([keyOf(SPOKES.main)]);
  });

  it('skips V4 reserves without aaveProReserveId', () => {
    const reserves = [makeV4Reserve(1, '0xAa', SPOKES.main, '')];
    expect(Object.keys(deriveV4ReservesBySpoke(reserves))).toHaveLength(0);
  });

  it('skips V4 reserves with unparseable aaveProReserveId', () => {
    const reserves = [makeV4Reserve(1, '0xAa', SPOKES.main, 'invalid!!!')];
    expect(Object.keys(deriveV4ReservesBySpoke(reserves))).toHaveLength(0);
  });

  it('returns empty record for empty reserves', () => {
    expect(deriveV4ReservesBySpoke([])).toEqual({});
  });
});
