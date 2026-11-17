/**
 * AAV-1399 — 链上读取钱包的 eMode 类别。
 *
 * 每个链一次 multicall（`allowFailure: true`），批量读所有需要评估的 V3 pool；
 * 单池失败只丢该池，整链轮换耗尽只降级（console error + 空结果），不 throw。
 * 与 `useOnchainHealthFactor` 的降级策略保持一致。
 */
import type { PublicClient } from 'viem';
import { MULTICALL3_ADDRESS, POOL_ABI } from './aaveV3UserClient';
import { createClientWithRpcRotation, isRpcRotationExhausted } from './rpcResilience';
import type { V3EModeTarget } from './eMode';

export type { V3EModeTarget } from './eMode';

interface GetUserEModeCallResult {
  status: 'success' | 'failure';
  /** viem decodes a single uint256 as bigint; tolerate tuple shapes from other clients. */
  result?: bigint | readonly bigint[];
}

export async function fetchOnchainEModeCategoryIds(
  address: `0x${string}`,
  targets: readonly V3EModeTarget[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const byChain = new Map<number, V3EModeTarget[]>();
  for (const target of targets) {
    const bucket = byChain.get(target.chainId) ?? [];
    bucket.push(target);
    byChain.set(target.chainId, bucket);
  }

  const fetchPromises: Promise<void>[] = [];
  for (const [chainId, pools] of byChain.entries()) {
    const clientPromise = createClientWithRpcRotation(chainId);

    fetchPromises.push(
      (async () => {
        let client: PublicClient | null;
        try {
          client = await clientPromise;
        } catch (err) {
          if (isRpcRotationExhausted(err)) {
            console.error(`[emode] chain ${chainId} RPC rotation exhausted`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
          } else {
            console.error(`[emode] chain ${chainId} client creation failed:`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
          }
          return;
        }
        if (!client) return;

        try {
          const multicall = client.multicall as unknown as (params: Record<string, unknown>) => Promise<unknown>;
          const results = (await multicall({
            contracts: pools.map((pool) => ({
              address: pool.poolAddress,
              abi: POOL_ABI,
              functionName: 'getUserEMode',
              args: [address],
            })),
            multicallAddress: MULTICALL3_ADDRESS,
            allowFailure: true,
          })) as GetUserEModeCallResult[];

          pools.forEach((pool, index) => {
            const call = results[index];
            if (!call || call.status !== 'success' || call.result === undefined) return;
            const first = Array.isArray(call.result) ? call.result[0] : call.result;
            if (typeof first !== 'bigint') return;
            if (first > BigInt(Number.MAX_SAFE_INTEGER)) return;
            result.set(pool.poolKey, Number(first));
          });
        } catch (err) {
          console.error(`[emode] chain ${chainId} multicall failed:`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
        }
      })(),
    );
  }

  await Promise.allSettled(fetchPromises);
  return result;
}
