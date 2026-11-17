/**
 * AAV-1399 — 链上 `getUserEMode` 批量读取的失败/降级语义。
 *
 * 通过 mock `createClientWithRpcRotation` 注入 client；断言只关心
 * 「哪些池拿到了 category」「失败是否只影响该池」「耗尽是否不 throw」。
 */
import { describe, it, expect, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { RpcRotationExhaustedError } from './rpcResilience';
import { fetchOnchainEModeCategoryIds, type V3EModeTarget } from './onchainEMode';

const rpcMocks = vi.hoisted(() => ({ createClientWithRpcRotation: vi.fn() }));

vi.mock('@/lib/userData/rpcResilience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/userData/rpcResilience')>();
  return { ...actual, createClientWithRpcRotation: rpcMocks.createClientWithRpcRotation };
});

const USER = '0x1111111111111111111111111111111111111111' as const;

function target(
  poolKey: string,
  chainId = 1,
  poolAddress = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
): V3EModeTarget {
  return {
    chainId,
    poolKey,
    marketKey: `${chainId}:${poolAddress.toLowerCase()}`,
    poolAddress: poolAddress as `0x${string}`,
  };
}

function makeClient(multicall: ReturnType<typeof vi.fn>): PublicClient {
  return { multicall } as unknown as PublicClient;
}

const ok = (value: bigint) => ({ status: 'success', result: value });
const fail = () => ({ status: 'failure', result: undefined });

describe('fetchOnchainEModeCategoryIds (AAV-1399)', () => {
  it('O1: maps category ids for all pools on a chain', async () => {
    const multicall = vi.fn(async () => [ok(1n), ok(0n), ok(40n)]);
    rpcMocks.createClientWithRpcRotation.mockResolvedValue(makeClient(multicall));

    const result = await fetchOnchainEModeCategoryIds(USER, [
      target('1:AaveV3Ethereum'),
      target('1:AaveV3EthereumLido'),
      target('1:AaveV3EthereumEtherFi'),
    ]);

    expect(result.get('1:AaveV3Ethereum')).toBe(1);
    expect(result.get('1:AaveV3EthereumLido')).toBe(0);
    expect(result.get('1:AaveV3EthereumEtherFi')).toBe(40);
  });

  it('O2: a failed call only drops that pool', async () => {
    const multicall = vi.fn(async () => [ok(1n), fail(), ok(2n)]);
    rpcMocks.createClientWithRpcRotation.mockResolvedValue(makeClient(multicall));

    const result = await fetchOnchainEModeCategoryIds(USER, [
      target('1:AaveV3Ethereum'),
      target('1:AaveV3EthereumLido'),
      target('1:AaveV3EthereumEtherFi'),
    ]);

    expect(result.has('1:AaveV3EthereumLido')).toBe(false);
    expect(result.get('1:AaveV3Ethereum')).toBe(1);
    expect(result.get('1:AaveV3EthereumEtherFi')).toBe(2);
  });

  it('O3: RPC rotation exhaustion → empty map, console error, no throw', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcMocks.createClientWithRpcRotation.mockImplementation(async () => {
      throw new RpcRotationExhaustedError(1);
    });

    const result = await fetchOnchainEModeCategoryIds(USER, [target('1:AaveV3Ethereum')]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('RPC rotation exhausted');
    errorSpy.mockRestore();
  });

  it('O4: one client + one multicall per chain, two chains otherwise', async () => {
    const multicall1 = vi.fn(async () => [ok(1n), ok(2n)]);
    const multicall10 = vi.fn(async () => [ok(3n)]);
    rpcMocks.createClientWithRpcRotation.mockImplementation(async (chainId: number) =>
      makeClient(chainId === 1 ? multicall1 : multicall10),
    );

    const result = await fetchOnchainEModeCategoryIds(USER, [
      target('1:AaveV3Ethereum'),
      target('1:AaveV3EthereumLido'),
      target('10:AaveV3Optimism', 10, '0x794a61358D6845594F94dc1DB02A252b5b4814aD'),
    ]);

    expect(rpcMocks.createClientWithRpcRotation).toHaveBeenCalledTimes(2);
    expect(multicall1).toHaveBeenCalledTimes(1);
    expect(multicall10).toHaveBeenCalledTimes(1);
    expect(result.get('10:AaveV3Optimism')).toBe(3);
  });

  it('O5: non-exhaustion client error is absorbed (no exhaustion log)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcMocks.createClientWithRpcRotation.mockImplementation(async () => {
      throw new Error('unexpected');
    });

    const result = await fetchOnchainEModeCategoryIds(USER, [target('1:AaveV3Ethereum')]);

    expect(result.size).toBe(0);
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('RPC rotation exhausted'), expect.any(Error));
    errorSpy.mockRestore();
  });

  it('O6: empty targets → empty map without touching the network', async () => {
    const result = await fetchOnchainEModeCategoryIds(USER, []);
    expect(result.size).toBe(0);
    expect(rpcMocks.createClientWithRpcRotation).not.toHaveBeenCalled();
  });
});
