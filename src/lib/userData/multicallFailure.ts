/**
 * Failure semantics for on-chain multicalls (AAV-1314).
 *
 * `allowFailure: true` keeps one reverted call from sinking the batch, but it
 * also makes "every call failed" look exactly like "this wallet has no
 * positions" — an empty result with an empty `errors` array. These helpers
 * separate a successful read from a failed one so the callers can report the
 * all-failed case through the existing errors channel.
 */

export const MULTICALL_ALL_CALLS_FAILED_TYPE = 'multicall-all-calls-failed';
export const MULTICALL_ALL_CALLS_FAILED_NAME = 'MulticallAllCallsFailedError';

export type MulticallCallResult<T> =
  { status: 'success'; result: T; error?: undefined } | { status: 'failure'; result?: undefined; error: Error };

/**
 * A read succeeded when the call reports success and carries a value.
 * `result !== undefined` is deliberate: `0n` is falsy but a zero balance is a
 * perfectly good read, and conflating the two drops borrow-only positions.
 */
export function isSuccessfulRead<T>(
  read: MulticallCallResult<T> | undefined,
): read is { status: 'success'; result: T; error?: undefined } {
  return read?.status === 'success' && read.result !== undefined;
}

/**
 * Thrown when a multicall returned zero successful reserve reads — the client
 * is healthy (unlike `RpcRotationExhaustedError`), the batch just produced
 * nothing usable. Carries the scope whose reads all failed: a V3 market name
 * or a V4 spoke name.
 */
export class MulticallAllCallsFailedError extends Error {
  readonly type = MULTICALL_ALL_CALLS_FAILED_TYPE;

  constructor(
    readonly chainId: number,
    readonly scope: string,
    readonly attemptedCalls: number,
  ) {
    super(
      `multicall returned no successful reads for ${scope} on chain ${chainId} (${attemptedCalls} calls attempted)`,
    );
    this.name = MULTICALL_ALL_CALLS_FAILED_NAME;
  }
}
