import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isInfrastructureFailure,
  withTimeout,
  classifyRpcError,
  createClientWithRpcRotation,
  readWithRpcRotation,
  RpcRotationExhaustedError,
  isRpcRotationExhausted,
} from './rpcResilience';
import { isRpcUnhealthy, markRpcUnhealthy, resetRpcHealthCache } from './rpcHealth';
import { getAllRpcUrls } from './chainDiscovery';
import { createPublicClient } from 'viem';

vi.mock('./chainDiscovery', () => ({
  getAllRpcUrls: vi.fn(),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getChainId: vi.fn(),
  })),
  http: vi.fn(() => 'mocked-transport'),
}));

describe('isInfrastructureFailure', () => {
  it('returns false for null', () => {
    expect(isInfrastructureFailure(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isInfrastructureFailure(undefined)).toBe(false);
  });

  it('returns true for timeout error', () => {
    expect(isInfrastructureFailure(new Error('Request timed out'))).toBe(true);
  });

  it('returns true for 5xx error', () => {
    expect(isInfrastructureFailure(new Error('Server returned 502'))).toBe(true);
  });

  it('returns true for fetch reject', () => {
    expect(isInfrastructureFailure(new Error('fetch failed'))).toBe(true);
  });

  it('returns true for network error', () => {
    expect(isInfrastructureFailure(new Error('network error'))).toBe(true);
  });

  it('returns true for GraphQL error', () => {
    expect(isInfrastructureFailure(new Error('GraphQL query failed'))).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    expect(isInfrastructureFailure(new Error('ECONNRESET'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isInfrastructureFailure(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isInfrastructureFailure(new Error('Some warning'))).toBe(false);
  });

  it('returns false for non-Error object', () => {
    expect(isInfrastructureFailure('string error')).toBe(false);
  });

  it('returns false for number', () => {
    expect(isInfrastructureFailure(42)).toBe(false);
  });

  it('returns true for error with "timeout" in message (case-insensitive)', () => {
    expect(isInfrastructureFailure(new Error('CONNECTION TIMEOUT'))).toBe(true);
  });

  it('returns true for error with "5xx" literal', () => {
    expect(isInfrastructureFailure(new Error('Received 5xx response'))).toBe(true);
  });
});

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'test');
    expect(result).toBe(42);
  });

  it('rejects on timeout', async () => {
    const neverResolves = new Promise<number>(() => {});
    await expect(withTimeout(neverResolves, 50, 'test-op')).rejects.toThrow('test-op timed out after 50ms');
  });

  it('cleans up timer on resolve', async () => {
    vi.useFakeTimers();
    const result = await withTimeout(Promise.resolve('ok'), 5000, 'test');
    expect(result).toBe('ok');
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
  });

  it('cleans up timer on reject', async () => {
    vi.useFakeTimers();
    const rejectsImmediately = Promise.reject(new Error('fail'));
    await expect(withTimeout(rejectsImmediately, 5000, 'test')).rejects.toThrow('fail');
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
  });

  it('preserves rejection reason when promise rejects before timeout', async () => {
    const rejectsFast = Promise.reject(new Error('quick fail'));
    await expect(withTimeout(rejectsFast, 5000, 'test')).rejects.toThrow('quick fail');
  });
});

describe('classifyRpcError', () => {
  it('classifies ETIMEDOUT as network', () => {
    expect(classifyRpcError(new Error('ETIMEDOUT'))).toBe('network');
  });

  it('classifies ECONNRESET as network', () => {
    expect(classifyRpcError(new Error('ECONNRESET'))).toBe('network');
  });

  it('classifies "fetch failed" as network', () => {
    expect(classifyRpcError(new Error('fetch failed'))).toBe('network');
  });

  it('classifies "network" as network', () => {
    expect(classifyRpcError(new Error('network disconnected'))).toBe('network');
  });

  it('classifies "timeout" as network', () => {
    expect(classifyRpcError(new Error('timeout exceeded'))).toBe('network');
  });

  it('classifies CALL_EXCEPTION as contract', () => {
    expect(classifyRpcError(new Error('CALL_EXCEPTION'))).toBe('contract');
  });

  it('classifies UNPREDICTABLE_GAS_LIMIT as contract', () => {
    expect(classifyRpcError(new Error('UNPREDICTABLE_GAS_LIMIT'))).toBe('contract');
  });

  it('classifies "revert" as contract', () => {
    expect(classifyRpcError(new Error('execution reverted'))).toBe('contract');
  });

  it('classifies generic Error as unknown', () => {
    expect(classifyRpcError(new Error('something else'))).toBe('unknown');
  });

  it('classifies non-Error as unknown', () => {
    expect(classifyRpcError('string')).toBe('unknown');
  });

  it('classifies null as unknown', () => {
    expect(classifyRpcError(null)).toBe('unknown');
  });

  it('classifies undefined as unknown', () => {
    expect(classifyRpcError(undefined)).toBe('unknown');
  });
});

describe('createClientWithRpcRotation catch path', () => {
  const mockedGetAllRpcUrls = vi.mocked(getAllRpcUrls);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs network error type when RPC fails with ETIMEDOUT', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com']);
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    } as unknown as ReturnType<typeof createPublicClient>);

    await expect(createClientWithRpcRotation(1)).rejects.toBeInstanceOf(RpcRotationExhaustedError);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('(network)'), expect.any(Error));
  });

  it('logs contract error type when RPC fails with CALL_EXCEPTION', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com']);
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('CALL_EXCEPTION')),
    } as unknown as ReturnType<typeof createPublicClient>);

    await expect(createClientWithRpcRotation(1)).rejects.toBeInstanceOf(RpcRotationExhaustedError);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('(contract)'), expect.any(Error));
  });

  it('logs unknown error type when RPC fails with generic error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com']);
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('something unexpected')),
    } as unknown as ReturnType<typeof createPublicClient>);

    await expect(createClientWithRpcRotation(1)).rejects.toBeInstanceOf(RpcRotationExhaustedError);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('(unknown)'), expect.any(Error));
  });
});

describe('createClientWithRpcRotation exhaustion semantics (AAV-1310)', () => {
  const mockedGetAllRpcUrls = vi.mocked(getAllRpcUrls);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null (no throw) when registry has no RPC URLs', async () => {
    mockedGetAllRpcUrls.mockReturnValue([]);
    await expect(createClientWithRpcRotation(999991)).resolves.toBeNull();
  });

  it('throws when all RPC URLs fail (rotation exhausted), with type marker', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetAllRpcUrls.mockReturnValue(['https://rpc-a.example.com', 'https://rpc-b.example.com']);
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    } as unknown as ReturnType<typeof createPublicClient>);

    const chainId = 42220;
    const err = await createClientWithRpcRotation(chainId).then(
      () => {
        throw new Error('expected exhaustion error, got null/client');
      },
      (e: unknown) => e as Error,
    );

    expect(err).toBeInstanceOf(RpcRotationExhaustedError);
    expect(err.message).toContain('RPC rotation exhausted for chain 42220');
    expect((err as RpcRotationExhaustedError).type).toBe('rpc-rotation-exhausted');
    expect(warnSpy).toHaveBeenCalledTimes(2); // per-URL warn still emitted before throwing
  });

  it('does not throw when at least one RPC succeeds (rotation itself works)', async () => {
    const clients = [
      { getChainId: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')) },
      { getChainId: vi.fn().mockResolvedValue(1) },
    ];
    vi.mocked(createPublicClient).mockImplementation(
      () => clients.shift() as unknown as ReturnType<typeof createPublicClient>,
    );
    mockedGetAllRpcUrls.mockReturnValue(['https://rpc-a.example.com', 'https://rpc-b.example.com']);

    await expect(createClientWithRpcRotation(1)).resolves.not.toBeNull();
  });
});

describe('isRpcRotationExhausted (AAV-1310)', () => {
  it('recognises a real instance', () => {
    expect(isRpcRotationExhausted(new RpcRotationExhaustedError(1))).toBe(true);
  });

  it('recognises a cross-chunk duplicate instance by name/type (instanceof fallback)', () => {
    // 打包器把模块拆进多个 chunk 时会出现第二个 class 实例，`instanceof` 静默失效。
    const duplicate = Object.assign(new Error('RPC rotation exhausted for chain 1'), {
      name: 'RpcRotationExhaustedError',
      type: 'rpc-rotation-exhausted',
    });
    expect(duplicate instanceof RpcRotationExhaustedError).toBe(false);
    expect(isRpcRotationExhausted(duplicate)).toBe(true);
  });

  it('rejects unrelated errors, null and undefined', () => {
    expect(isRpcRotationExhausted(new Error('ETIMEDOUT'))).toBe(false);
    expect(isRpcRotationExhausted(null)).toBe(false);
    expect(isRpcRotationExhausted(undefined)).toBe(false);
    expect(isRpcRotationExhausted('rpc-rotation-exhausted')).toBe(false);
  });
});

describe('readWithRpcRotation (AAV-1387)', () => {
  const mockedGetAllRpcUrls = vi.mocked(getAllRpcUrls);
  const mockedCreatePublicClient = vi.mocked(createPublicClient);
  const A = 'https://rpc-a.example.com';
  const B = 'https://rpc-b.example.com';

  type FakeClient = { url: string };

  const urlOf = (client: unknown): string => (client as FakeClient).url;

  /** Mock viem so every client remembers which URL it was built for. */
  function serveClients(probe: (url: string) => Promise<number> = () => Promise.resolve(1)): void {
    mockedCreatePublicClient.mockImplementation(((params: { chain: { rpcUrls: { default: { http: string[] } } } }) => {
      const url = params.chain.rpcUrls.default.http[0];
      return { url, getChainId: vi.fn(() => probe(url)) };
    }) as unknown as typeof createPublicClient);
  }

  beforeEach(() => {
    resetRpcHealthCache();
    mockedGetAllRpcUrls.mockReset();
    mockedCreatePublicClient.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('R1 rotates when the first RPC reports all calls failed', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({
      value: urlOf(client),
      allCallsFailed: urlOf(client) === A,
    }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(isRpcUnhealthy(1, A)).toBe(true);
    expect(isRpcUnhealthy(1, B)).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('returned no successful reads'));
  });

  it('R2 returns the last all-failed result when no RPC has data', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({ value: urlOf(client), allCallsFailed: true }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(isRpcUnhealthy(1, A)).toBe(true);
    expect(isRpcUnhealthy(1, B)).toBe(true);
  });

  it('R3 does not rotate on a partial read', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({ value: urlOf(client), allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(A);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(isRpcUnhealthy(1, A)).toBe(false);
  });

  it('R4 rotates when the attempt throws', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => {
      if (urlOf(client) === A) throw new Error('HTTP request failed.');
      return { value: urlOf(client), allCallsFailed: false };
    });

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(isRpcUnhealthy(1, A)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('read failed'), expect.any(Error));
  });

  it('R5 rethrows the last attempt error when every RPC throws', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const errorA = new Error('payload too large (a)');
    const errorB = new Error('payload too large (b)');
    const attempt = vi.fn(async (client: unknown) => {
      throw urlOf(client) === A ? errorA : errorB;
    });

    await expect(readWithRpcRotation(1, attempt)).rejects.toBe(errorB);
  });

  it('R6 throws RpcRotationExhaustedError when every probe fails', async () => {
    serveClients(() => Promise.reject(new Error('ETIMEDOUT')));
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async () => ({ value: 'never', allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).rejects.toBeInstanceOf(RpcRotationExhaustedError);
    expect(attempt).not.toHaveBeenCalled();
  });

  it('R7 returns null when the chain has no RPC URLs', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([]);
    const attempt = vi.fn(async () => ({ value: 'never', allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
    expect(mockedCreatePublicClient).not.toHaveBeenCalled();
  });

  it('R8 skips a demoted RPC on the next read', async () => {
    markRpcUnhealthy(1, A);
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({ value: urlOf(client), allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(mockedCreatePublicClient).toHaveBeenCalledTimes(1);
  });

  it('R9 retries the full list when every RPC is demoted (anti-lockout)', async () => {
    markRpcUnhealthy(1, A);
    markRpcUnhealthy(1, B);
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({
      value: urlOf(client),
      allCallsFailed: urlOf(client) === A,
    }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('R10 clears the demotion when a read succeeds again', async () => {
    markRpcUnhealthy(1, A);
    markRpcUnhealthy(1, B);
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({ value: urlOf(client), allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(A);

    expect(isRpcUnhealthy(1, A)).toBe(false);
  });

  it('R11 probe success does not resurrect a demoted URL', async () => {
    markRpcUnhealthy(1, A);
    markRpcUnhealthy(1, B);
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);

    await expect(createClientWithRpcRotation(1)).resolves.not.toBeNull();

    expect(isRpcUnhealthy(1, A)).toBe(true);
  });

  it('R12 hands the attempt the client built for that URL', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const seen: string[] = [];
    const attempt = vi.fn(async (client: unknown) => {
      seen.push(urlOf(client));
      return { value: urlOf(client), allCallsFailed: urlOf(client) === A };
    });

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(B);

    expect(seen).toEqual([A, B]);
  });

  // M17: a domain all-failed batch is stronger evidence than a transport error,
  // so the value wins whichever order the endpoints are tried in.
  it('R13 returns the all-failed value even when another endpoint throws', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);

    const throwThenFailed = vi.fn(async (client: unknown) => {
      if (urlOf(client) === A) throw new Error('HTTP request failed.');
      return { value: 'b-no-reads', allCallsFailed: true };
    });
    await expect(readWithRpcRotation(1, throwThenFailed)).resolves.toBe('b-no-reads');

    resetRpcHealthCache();

    const failedThenThrow = vi.fn(async (client: unknown) => {
      if (urlOf(client) === A) return { value: 'a-no-reads', allCallsFailed: true };
      throw new Error('HTTP request failed.');
    });
    await expect(readWithRpcRotation(1, failedThenThrow)).resolves.toBe('a-no-reads');
  });

  // M18: the health filter must not become a lockout when the one surviving
  // endpoint fails its probe too — the demoted endpoints get one more try.
  it('R14 retries demoted endpoints when the surviving endpoint fails its probe', async () => {
    markRpcUnhealthy(1, A);
    serveClients((url) => (url === B ? Promise.reject(new Error('ETIMEDOUT')) : Promise.resolve(1)));
    mockedGetAllRpcUrls.mockReturnValue([A, B]);
    const attempt = vi.fn(async (client: unknown) => ({ value: urlOf(client), allCallsFailed: false }));

    await expect(readWithRpcRotation(1, attempt)).resolves.toBe(A);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(isRpcUnhealthy(1, A)).toBe(false);
  });

  // M16: both readers pick their candidate before either demotes, so one keeps
  // a client for a URL the other just marked unhealthy. The later success wins
  // and neither read is lost.
  it('R15 a concurrent success clears a demotion made while it was in flight', async () => {
    serveClients();
    mockedGetAllRpcUrls.mockReturnValue([A, B]);

    let aAttempts = 0;
    const attempt = vi.fn(async (client: unknown) => {
      if (urlOf(client) !== A) return { value: 'b-ok', allCallsFailed: false };
      aAttempts += 1;
      return aAttempts === 1
        ? { value: 'a-all-failed', allCallsFailed: true }
        : { value: 'a-ok', allCallsFailed: false };
    });

    const values = await Promise.all([readWithRpcRotation(1, attempt), readWithRpcRotation(1, attempt)]);

    expect([...values].sort()).toEqual(['a-ok', 'b-ok']);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(isRpcUnhealthy(1, A)).toBe(false);
    expect(isRpcUnhealthy(1, B)).toBe(false);
  });
});
