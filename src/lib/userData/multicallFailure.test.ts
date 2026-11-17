import { describe, it, expect } from 'vitest';
import {
  MULTICALL_ALL_CALLS_FAILED_NAME,
  MULTICALL_ALL_CALLS_FAILED_TYPE,
  MulticallAllCallsFailedError,
  isSuccessfulRead,
} from './multicallFailure';

describe('MulticallAllCallsFailedError (AAV-1314)', () => {
  it('carries chain, scope, attempted calls and a decidable type/name', () => {
    const err = new MulticallAllCallsFailedError(1, 'AaveV3Ethereum', 3);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(MULTICALL_ALL_CALLS_FAILED_NAME);
    expect(err.type).toBe(MULTICALL_ALL_CALLS_FAILED_TYPE);
    expect(err.chainId).toBe(1);
    expect(err.scope).toBe('AaveV3Ethereum');
    expect(err.attemptedCalls).toBe(3);
    expect(err.message).toContain('AaveV3Ethereum');
    expect(err.message).toContain('chain 1');
    expect(err.message).toContain('3');
  });
});

describe('isSuccessfulRead (AAV-1314)', () => {
  // The whole AAV-1314 judgement hangs on this: 0n is falsy in JS, but a zero
  // balance is a successful read, not a failure.
  it('treats a zero result as a successful read', () => {
    expect(isSuccessfulRead({ status: 'success', result: 0n })).toBe(true);
  });

  it('treats a zero-valued tuple as a successful read', () => {
    expect(isSuccessfulRead({ status: 'success', result: [0n, 0n] })).toBe(true);
  });

  it('rejects failure results', () => {
    expect(isSuccessfulRead({ status: 'failure', error: new Error('revert') })).toBe(false);
  });

  it('rejects missing entries', () => {
    expect(isSuccessfulRead(undefined)).toBe(false);
  });

  it('rejects a success entry without a result (malformed shape)', () => {
    expect(isSuccessfulRead({ status: 'success', result: undefined })).toBe(false);
  });
});
