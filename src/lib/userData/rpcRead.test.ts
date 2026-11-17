import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRpcClientPool } from './rpcResilience';
import { readFromHealthyRpc } from './rpcRead';

const rotationMocks = vi.hoisted(() => ({ readWithRpcRotation: vi.fn() }));

vi.mock('./rpcResilience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rpcResilience')>();
  return { ...actual, readWithRpcRotation: rotationMocks.readWithRpcRotation };
});

describe('readFromHealthyRpc (AAV-1387)', () => {
  beforeEach(() => {
    rotationMocks.readWithRpcRotation.mockReset();
  });

  it('reads on the injected client without consulting rotation', async () => {
    const client = { tag: 'injected' };
    const attempt = vi.fn(async () => ({ value: 'batch', allCallsFailed: false }));

    await expect(readFromHealthyRpc(1, client as never, attempt)).resolves.toBe('batch');

    expect(attempt).toHaveBeenCalledWith(client);
    expect(rotationMocks.readWithRpcRotation).not.toHaveBeenCalled();
  });

  it('delegates to rotation when no client is injected', async () => {
    rotationMocks.readWithRpcRotation.mockResolvedValue('rotated');
    const attempt = vi.fn(async () => ({ value: 'batch', allCallsFailed: false }));

    await expect(readFromHealthyRpc(1, undefined, attempt)).resolves.toBe('rotated');

    expect(rotationMocks.readWithRpcRotation).toHaveBeenCalledWith(1, attempt);
    expect(attempt).not.toHaveBeenCalled();
  });

  it('passes a null rotation result through for the empty degradation', async () => {
    rotationMocks.readWithRpcRotation.mockResolvedValue(null);

    await expect(
      readFromHealthyRpc(1, undefined, async () => ({ value: 'batch', allCallsFailed: false })),
    ).resolves.toBeNull();
  });

  it('forwards the chain read session to rotation when one is supplied (AAV-1313)', async () => {
    rotationMocks.readWithRpcRotation.mockResolvedValue('rotated');
    const pool = createRpcClientPool();
    const attempt = vi.fn(async () => ({ value: 'batch', allCallsFailed: false }));

    await expect(readFromHealthyRpc(1, undefined, attempt, pool)).resolves.toBe('rotated');

    expect(rotationMocks.readWithRpcRotation).toHaveBeenCalledWith(1, attempt, pool);
  });

  it('ignores the session when a client is injected', async () => {
    const client = { tag: 'injected' };
    const pool = createRpcClientPool();
    const attempt = vi.fn(async () => ({ value: 'batch', allCallsFailed: false }));

    await expect(readFromHealthyRpc(1, client as never, attempt, pool)).resolves.toBe('batch');

    expect(rotationMocks.readWithRpcRotation).not.toHaveBeenCalled();
  });
});
