import type { PublicClient } from 'viem';
import { readWithRpcRotation, type RpcClientPool, type RpcReadAttempt } from './rpcResilience';

/**
 * Reads through `attempt` either on a caller-supplied client (tests, the
 * health-factor path) or through RPC rotation (AAV-1387), so both user clients
 * share one branch instead of copying it.
 *
 * Lives outside `rpcResilience.ts` on purpose: a call to `readWithRpcRotation`
 * written there would be an intra-module reference and could not be mocked,
 * which is exactly what the user-client rotation tests replace.
 *
 * `pool` carries the per-chain read session (AAV-1313) so a wallet sync probes
 * each chain's endpoints once instead of once per market/spoke. It never
 * replaces rotation: a pooled endpoint that fails a batch is released and the
 * next endpoint is tried.
 *
 * `null` only when the chain has no configured RPC — callers degrade to an
 * empty result.
 */
export async function readFromHealthyRpc<T>(
  chainId: number,
  client: PublicClient | undefined,
  attempt: (client: PublicClient) => Promise<RpcReadAttempt<T>>,
  pool?: RpcClientPool,
): Promise<T | null> {
  if (client) return (await attempt(client)).value;
  // Pass the session only when there is one: without it the call stays exactly
  // `readWithRpcRotation(chainId, attempt)`, which is what every existing
  // rotation assertion and the AAV-1387 behaviour expect.
  return pool ? readWithRpcRotation(chainId, attempt, pool) : readWithRpcRotation(chainId, attempt);
}
