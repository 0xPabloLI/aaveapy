import { createPublicClient, http, type PublicClient } from 'viem';
import { getAllRpcUrls } from './chainDiscovery';
import { clearRpcUnhealthy, markRpcUnhealthy, selectRpcUrlsByHealth } from './rpcHealth';

export function isInfrastructureFailure(error: unknown): boolean {
  if (!error) return false;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('5xx') ||
    /5\d\d/.test(msg) ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('graphql') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function classifyRpcError(err: unknown): 'network' | 'contract' | 'unknown' {
  if (!(err instanceof Error)) return 'unknown';
  const msg = err.message.toLowerCase();
  if (
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout')
  )
    return 'network';
  if (msg.includes('call_exception') || msg.includes('unpredictable_gas_limit') || msg.includes('revert'))
    return 'contract';
  return 'unknown';
}

/**
 * Thrown by `createClientWithRpcRotation` when the chain is configured with
 * RPC URLs but every endpoint fails (timeout / 5xx / network) — an
 * infrastructure failure, distinct from a chain absent from the registry
 * (which returns `null` and degrades to an empty result).
 */
export const RPC_ROTATION_EXHAUSTED_TYPE = 'rpc-rotation-exhausted';
export const RPC_ROTATION_EXHAUSTED_NAME = 'RpcRotationExhaustedError';

export class RpcRotationExhaustedError extends Error {
  readonly type = RPC_ROTATION_EXHAUSTED_TYPE;

  constructor(chainId: number) {
    super(`RPC rotation exhausted for chain ${chainId}`);
    this.name = RPC_ROTATION_EXHAUSTED_NAME;
  }
}

/**
 * 判定是否为「RPC 轮换耗尽」。
 *
 * 首选 `instanceof`，但打包器把本模块拆进多个 chunk 时可能出现两个 class 实例，
 * `instanceof` 会静默失效 —— 那会让消费方把 exhaustion 当普通异常 rethrow，
 * 被 `Promise.allSettled` 无声吞掉，退回 AAV-1310 想消灭的静默失败。
 * 因此退化到 `name` / `type` 的结构化判定作为兜底。
 */
export function isRpcRotationExhausted(error: unknown): boolean {
  if (error instanceof RpcRotationExhaustedError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; type?: unknown };
  return candidate.name === RPC_ROTATION_EXHAUSTED_NAME || candidate.type === RPC_ROTATION_EXHAUSTED_TYPE;
}

export async function createClientWithRpcRotation(chainId: number): Promise<PublicClient | null> {
  const rpcUrls = getAllRpcUrls(chainId);
  if (rpcUrls.length === 0) return null;

  for await (const { client } of healthyRpcClients(chainId, selectRpcUrlsByHealth(chainId, rpcUrls))) return client;
  throw new RpcRotationExhaustedError(chainId);
}

/**
 * One batch read against one client. `allCallsFailed` is the caller's own
 * "nothing was readable here" judgement (V3: no reserve read succeeded), which
 * is why the retry policy lives here instead of matching error strings: a node
 * can be healthy on `eth_chainId` and still refuse the real payload.
 */
export interface RpcReadAttempt<T> {
  value: T;
  allCallsFailed: boolean;
}

/**
 * Runs `attempt` against endpoints in curated order, moving on when a node
 * turns out to be unusable for real reads (AAV-1387).
 *
 * - `attempt` reports `allCallsFailed` → the URL is demoted for this session
 *   and the next endpoint is tried. The last such value is returned when no
 *   endpoint has data, so callers keep their own all-failed error semantics
 *   (`MulticallAllCallsFailedError` → `failedSources`).
 * - `attempt` throws → the URL is demoted and the next endpoint is tried; the
 *   last error is rethrown when no endpoint produced a value.
 * - A value always wins over a thrown error, whichever order the endpoints are
 *   tried in: "the node answered and every call in the batch failed" is domain
 *   evidence about the chain, while a transport error only says that endpoint
 *   was unreachable.
 * - Every probe fails → `RpcRotationExhaustedError`, unchanged from AAV-1310.
 * - No RPC configured → `null` (callers degrade to an empty result).
 *
 * A successful read clears any demotion, so a recovered node is used again
 * without a reload. Probe success alone never clears it — the node that
 * motivated this (fastnode) answers `eth_chainId` fine and fails every batch.
 */
export async function readWithRpcRotation<T>(
  chainId: number,
  attempt: (client: PublicClient) => Promise<RpcReadAttempt<T>>,
): Promise<T | null> {
  const rpcUrls = getAllRpcUrls(chainId);
  if (rpcUrls.length === 0) return null;

  const preferred = selectRpcUrlsByHealth(chainId, rpcUrls);
  let outcome = await attemptAcrossRpcUrls(chainId, preferred, attempt);
  // Anti-lockout has to hold end to end: the health filter can narrow the list
  // down to a URL whose probe now fails too. Without this retry the demoted
  // endpoints are never probed and the chain stays unreadable for the session.
  if (outcome.attempts === 0 && preferred.length < rpcUrls.length) {
    outcome = await attemptAcrossRpcUrls(chainId, rpcUrls, attempt);
  }

  if (outcome.lastValue) return outcome.lastValue.value;
  if (outcome.lastError) throw outcome.lastError.error;
  throw new RpcRotationExhaustedError(chainId);
}

interface RotationOutcome<T> {
  /** Endpoints whose probe passed, i.e. how far the candidate list got. */
  attempts: number;
  lastValue: { value: T } | null;
  lastError: { error: unknown } | null;
}

async function attemptAcrossRpcUrls<T>(
  chainId: number,
  rpcUrls: readonly string[],
  attempt: (client: PublicClient) => Promise<RpcReadAttempt<T>>,
): Promise<RotationOutcome<T>> {
  const outcome: RotationOutcome<T> = { attempts: 0, lastValue: null, lastError: null };

  for await (const { url, client } of healthyRpcClients(chainId, rpcUrls)) {
    outcome.attempts += 1;
    try {
      const result = await attempt(client);
      if (!result.allCallsFailed) {
        clearRpcUnhealthy(chainId, url);
        return { ...outcome, lastValue: { value: result.value } };
      }
      markRpcUnhealthy(chainId, url);
      console.warn(`[rpc-rotation] ${url} returned no successful reads for chain ${chainId}; trying next RPC`);
      outcome.lastValue = { value: result.value };
    } catch (err) {
      markRpcUnhealthy(chainId, url);
      const errorType = classifyRpcError(err);
      console.warn(`[rpc-rotation] ${url} read failed for chain ${chainId} (${errorType}):`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      outcome.lastError = { error: err };
    }
  }

  return outcome;
}

const PROBE_TIMEOUT_MS = 3000;

function createClientForUrl(chainId: number, url: string): PublicClient {
  const chain = {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  };
  return createPublicClient({ chain, transport: http(url), batch: { multicall: true } }) as PublicClient;
}

/**
 * Yields clients whose `eth_chainId` probe passed, in the order given. The
 * caller picks the candidate list (health-filtered on the first pass, the full
 * list on the anti-lockout retry), so filtering and retrying cannot fight each
 * other. Shared by both entry points so the probe timeout and warn text cannot
 * drift apart.
 */
async function* healthyRpcClients(
  chainId: number,
  rpcUrls: readonly string[],
): AsyncGenerator<{ url: string; client: PublicClient }> {
  for (const url of rpcUrls) {
    const client = createClientForUrl(chainId, url);
    try {
      await withTimeout(client.getChainId(), PROBE_TIMEOUT_MS, `rpc-rotation-chain-${chainId}`);
      yield { url, client };
    } catch (err) {
      const errorType = classifyRpcError(err);
      console.warn(`[rpc-rotation] ${url} failed for chain ${chainId} (${errorType}):`, err); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      continue;
    }
  }
}
