import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isInfrastructureFailure, withTimeout, classifyRpcError, createClientWithRpcRotation } from './rpcResilience'
import { getAllRpcUrls } from './chainDiscovery'
import { createPublicClient } from 'viem'

vi.mock('./chainDiscovery', () => ({
  getAllRpcUrls: vi.fn(),
}))

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getChainId: vi.fn(),
  })),
  http: vi.fn(() => 'mocked-transport'),
}))

describe('isInfrastructureFailure', () => {
  it('returns false for null', () => {
    expect(isInfrastructureFailure(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isInfrastructureFailure(undefined)).toBe(false)
  })

  it('returns true for timeout error', () => {
    expect(isInfrastructureFailure(new Error('Request timed out'))).toBe(true)
  })

  it('returns true for 5xx error', () => {
    expect(isInfrastructureFailure(new Error('Server returned 502'))).toBe(true)
  })

  it('returns true for fetch reject', () => {
    expect(isInfrastructureFailure(new Error('fetch failed'))).toBe(true)
  })

  it('returns true for network error', () => {
    expect(isInfrastructureFailure(new Error('network error'))).toBe(true)
  })

  it('returns true for GraphQL error', () => {
    expect(isInfrastructureFailure(new Error('GraphQL query failed'))).toBe(true)
  })

  it('returns true for ECONNRESET', () => {
    expect(isInfrastructureFailure(new Error('ECONNRESET'))).toBe(true)
  })

  it('returns true for ETIMEDOUT', () => {
    expect(isInfrastructureFailure(new Error('ETIMEDOUT'))).toBe(true)
  })

  it('returns false for generic Error', () => {
    expect(isInfrastructureFailure(new Error('Some warning'))).toBe(false)
  })

  it('returns false for non-Error object', () => {
    expect(isInfrastructureFailure('string error')).toBe(false)
  })

  it('returns false for number', () => {
    expect(isInfrastructureFailure(42)).toBe(false)
  })

  it('returns true for error with "timeout" in message (case-insensitive)', () => {
    expect(isInfrastructureFailure(new Error('CONNECTION TIMEOUT'))).toBe(true)
  })

  it('returns true for error with "5xx" literal', () => {
    expect(isInfrastructureFailure(new Error('Received 5xx response'))).toBe(true)
  })
})

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'test')
    expect(result).toBe(42)
  })

  it('rejects on timeout', async () => {
    const neverResolves = new Promise<number>(() => {})
    await expect(withTimeout(neverResolves, 50, 'test-op')).rejects.toThrow('test-op timed out after 50ms')
  })

  it('cleans up timer on resolve', async () => {
    vi.useFakeTimers()
    const result = await withTimeout(Promise.resolve('ok'), 5000, 'test')
    expect(result).toBe('ok')
    vi.advanceTimersByTime(5000)
    vi.useRealTimers()
  })

  it('cleans up timer on reject', async () => {
    vi.useFakeTimers()
    const rejectsImmediately = Promise.reject(new Error('fail'))
    await expect(withTimeout(rejectsImmediately, 5000, 'test')).rejects.toThrow('fail')
    vi.advanceTimersByTime(5000)
    vi.useRealTimers()
  })

  it('preserves rejection reason when promise rejects before timeout', async () => {
    const rejectsFast = Promise.reject(new Error('quick fail'))
    await expect(withTimeout(rejectsFast, 5000, 'test')).rejects.toThrow('quick fail')
  })
})

describe('classifyRpcError', () => {
  it('classifies ETIMEDOUT as network', () => {
    expect(classifyRpcError(new Error('ETIMEDOUT'))).toBe('network')
  })

  it('classifies ECONNRESET as network', () => {
    expect(classifyRpcError(new Error('ECONNRESET'))).toBe('network')
  })

  it('classifies "fetch failed" as network', () => {
    expect(classifyRpcError(new Error('fetch failed'))).toBe('network')
  })

  it('classifies "network" as network', () => {
    expect(classifyRpcError(new Error('network disconnected'))).toBe('network')
  })

  it('classifies "timeout" as network', () => {
    expect(classifyRpcError(new Error('timeout exceeded'))).toBe('network')
  })

  it('classifies CALL_EXCEPTION as contract', () => {
    expect(classifyRpcError(new Error('CALL_EXCEPTION'))).toBe('contract')
  })

  it('classifies UNPREDICTABLE_GAS_LIMIT as contract', () => {
    expect(classifyRpcError(new Error('UNPREDICTABLE_GAS_LIMIT'))).toBe('contract')
  })

  it('classifies "revert" as contract', () => {
    expect(classifyRpcError(new Error('execution reverted'))).toBe('contract')
  })

  it('classifies generic Error as unknown', () => {
    expect(classifyRpcError(new Error('something else'))).toBe('unknown')
  })

  it('classifies non-Error as unknown', () => {
    expect(classifyRpcError('string')).toBe('unknown')
  })

  it('classifies null as unknown', () => {
    expect(classifyRpcError(null)).toBe('unknown')
  })

  it('classifies undefined as unknown', () => {
    expect(classifyRpcError(undefined)).toBe('unknown')
  })
})

describe('createClientWithRpcRotation catch path', () => {
  const mockedGetAllRpcUrls = vi.mocked(getAllRpcUrls)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logs network error type when RPC fails with ETIMEDOUT', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com'])
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    } as unknown as ReturnType<typeof createPublicClient>)

    await createClientWithRpcRotation(1)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('(network)'),
      expect.any(Error),
    )
  })

  it('logs contract error type when RPC fails with CALL_EXCEPTION', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com'])
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('CALL_EXCEPTION')),
    } as unknown as ReturnType<typeof createPublicClient>)

    await createClientWithRpcRotation(1)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('(contract)'),
      expect.any(Error),
    )
  })

  it('logs unknown error type when RPC fails with generic error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedGetAllRpcUrls.mockReturnValue(['https://failing-rpc.example.com'])
    vi.mocked(createPublicClient).mockReturnValue({
      getChainId: vi.fn().mockRejectedValue(new Error('something unexpected')),
    } as unknown as ReturnType<typeof createPublicClient>)

    await createClientWithRpcRotation(1)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('(unknown)'),
      expect.any(Error),
    )
  })
})
