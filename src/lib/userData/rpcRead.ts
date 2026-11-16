import type { PublicClient } from 'viem';
import { readWithRpcRotation, type RpcReadAttempt } from './rpcResilience';

/**
 * Reads through `attempt` either on a caller-supplied client (tests, the
 * health-factor path) or through RPC rotation (AAV-1387), so both user clients
 * share one branch instead of copying it.
 *
 * Lives outside `rpcResilience.ts` on purpose: a call to `readWithRpcRotation`
 * written there would be an intra-module reference and could not be mocked,
 * which is exactly what the user-client rotation tests replace.
 *
 * `null` only when the chain has no configured RPC — callers degrade to an
 * empty result.
 */
export async function readFromHealthyRpc<T>(
  chainId: number,
  client: PublicClient | undefined,
  attempt: (client: PublicClient) => Promise<RpcReadAttempt<T>>,
): Promise<T | null> {
  if (client) return (await attempt(client)).value;
  return readWithRpcRotation(chainId, attempt);
}
