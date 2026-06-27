import { describe, it, expect } from 'vitest';
import { buildHubAggregationMap, getHubAssetKey } from './hubAggregation';
import type { ReserveWithSpread } from '@/types/aave';

const makeReserve = (overrides: Partial<ReserveWithSpread> & {
  marketName: string;
  reserveId: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
}): ReserveWithSpread => ({
  ...overrides,
});

describe('buildHubAggregationMap', () => {
  it('returns empty map for V3 reserves (no hubId)', () => {
    const reserves = [
      makeReserve({
        marketName: 'AaveV3Ethereum', reserveId: 'v3:1:usdc',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        borrowed: '1000000', supplied: '5000000',
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    expect(map.size).toBe(0);
  });

  it('aggregates supplied across Spokes of same Hub+token', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, hubName: 'Core',
        borrowed: '1000000', supplied: '5000000',
      }),
      makeReserve({
        marketName: 'AaveV4Lido', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, hubName: 'Core',
        borrowed: '2000000', supplied: '3000000',
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    expect(key).toBe(`${hubId}:0xA0b8`);
    const agg = map.get(key!);
    expect(agg).toBeDefined();
    expect(agg!.hubSupplied).toBe('8000000');
  });

  it('separates different tokens on same Hub', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, borrowed: '1000', supplied: '5000',
      }),
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:eth:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'ETH', tokenSymbol: 'ETH', tokenAddress: '0xC02a',
        hubId, borrowed: '2000', supplied: '6000',
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    expect(map.size).toBe(2);
  });

  it('handles missing supplied gracefully', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId,
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    const agg = map.get(key!);
    expect(agg).toBeDefined();
    expect(agg!.hubSupplied).toBe('0');
  });
});

describe('getHubAssetKey', () => {
  it('returns null for V3 reserves without hubId', () => {
    const reserve = makeReserve({
      marketName: 'AaveV3Ethereum', reserveId: 'v3:1:usdc',
      chainName: 'Ethereum', chainId: 1,
      tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
    });
    expect(getHubAssetKey(reserve)).toBeNull();
  });

  it('returns hubId:tokenAddress for V4 reserves', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserve = makeReserve({
      marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
      chainName: 'Ethereum', chainId: 1,
      tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
      hubId,
    });
    expect(getHubAssetKey(reserve)).toBe('base64(1::0xHubAddr):0xA0b8');
  });
});

describe('buildHubAggregationMap boundary cases', () => {
  it('handles single-Spoke Hub (aggregate = single spoke value)', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const reserves = [
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, borrowed: '3000000', supplied: '7000000',
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    const agg = map.get(key!);
    expect(agg!.hubSupplied).toBe('7000000');
  });

  it('handles very large BigInt values without overflow', () => {
    const hubId = 'base64(1::0xHubAddr)';
    const largeValue = '999999999999999999999999999999';
    const reserves = [
      makeReserve({
        marketName: 'AaveV4Main', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, borrowed: largeValue, supplied: largeValue,
      }),
      makeReserve({
        marketName: 'AaveV4Lido', reserveId: 'v4:1:usdc:Core',
        chainName: 'Ethereum', chainId: 1,
        tokenName: 'USDC', tokenSymbol: 'USDC', tokenAddress: '0xA0b8',
        hubId, borrowed: largeValue, supplied: largeValue,
      }),
    ];
    const map = buildHubAggregationMap(reserves);
    const key = getHubAssetKey(reserves[0]);
    const agg = map.get(key!);
    const expected = (BigInt(largeValue) * 2n).toString();
    expect(agg!.hubSupplied).toBe(expected);
  });
});
