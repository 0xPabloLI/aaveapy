import { describe, it, expect } from 'vitest'
import type { WalletLoadState, DegradedResult, UserPositionsData } from './useUserPositions'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'

const STUB_POSITION: WalletPosition = {
  reserveId: '',
  chainId: 1,
  asset: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  tokenSymbol: '',
  side: 'supply',
  amountWad: 0n,
  amountUsd: 0,
  isCollateral: false,
  source: 'onchain-v3',
  isOrphan: false,
}

function computeWalletLoadState(params: {
  isConnected: boolean
  address?: `0x${string}`
  isLoading: boolean
  isError: boolean
  data?: UserPositionsData
}): WalletLoadState {
  const { isConnected, address, isLoading, isError, data } = params
  if (!isConnected || !address) return 'idle'
  if (isLoading) return 'loading'
  if (isError) return 'error'
  if (data && data.positions.length === 0 && data.failedSources.length === 0) return 'success-empty'
  return 'success'
}

function computeDegradedResult(params: {
  isError: boolean
  error?: Error
  data?: UserPositionsData
}): DegradedResult {
  const { isError, error, data } = params
  const retry = () => {}
  if (isError) return { status: 'error', error: error ?? new Error('Unknown'), retry }
  if (data) {
    if (data.failedSources.length > 0) return { status: 'partial', data, retry }
    return { status: 'success', data }
  }
  return { status: 'error', error: new Error('No data'), retry }
}

describe('WalletLoadState state machine', () => {
  it('returns idle when disconnected', () => {
    expect(computeWalletLoadState({ isConnected: false, isLoading: false, isError: false })).toBe('idle')
  })

  it('returns idle when no address', () => {
    expect(computeWalletLoadState({ isConnected: true, address: undefined, isLoading: false, isError: false })).toBe('idle')
  })

  it('returns loading when connected and loading', () => {
    expect(computeWalletLoadState({
      isConnected: true,
      address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      isLoading: true,
      isError: false,
    })).toBe('loading')
  })

  it('returns error on query error', () => {
    expect(computeWalletLoadState({
      isConnected: true,
      address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      isLoading: false,
      isError: true,
    })).toBe('error')
  })

  it('returns success-empty when no positions and no failures', () => {
    expect(computeWalletLoadState({
      isConnected: true,
      address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      isLoading: false,
      isError: false,
      data: { positions: [], failedSources: [] },
    })).toBe('success-empty')
  })

  it('returns success when positions exist', () => {
    expect(computeWalletLoadState({
      isConnected: true,
      address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      isLoading: false,
      isError: false,
      data: { positions: [STUB_POSITION], failedSources: [] },
    })).toBe('success')
  })

  it('returns success even with partial failures (positions still usable)', () => {
    expect(computeWalletLoadState({
      isConnected: true,
      address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      isLoading: false,
      isError: false,
      data: { positions: [], failedSources: ['onchain-v3-chain-1'] },
    })).toBe('success')
  })
})

describe('DegradedResult computation', () => {
  it('returns error on query error', () => {
    const result = computeDegradedResult({ isError: true, error: new Error('RPC fail') })
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.error.message).toBe('RPC fail')
  })

  it('returns partial when data has failedSources', () => {
    const data: UserPositionsData = { positions: [], failedSources: ['onchain-v3-chain-1'] }
    const result = computeDegradedResult({ isError: false, data })
    expect(result.status).toBe('partial')
    if (result.status === 'partial') expect(result.data.failedSources).toEqual(['onchain-v3-chain-1'])
  })

  it('returns success when data is complete', () => {
    const data: UserPositionsData = { positions: [STUB_POSITION], failedSources: [] }
    const result = computeDegradedResult({ isError: false, data })
    expect(result.status).toBe('success')
    if (result.status === 'success') expect(result.data.positions).toHaveLength(1)
  })

  it('returns error when no data and no error (edge case)', () => {
    const result = computeDegradedResult({ isError: false })
    expect(result.status).toBe('error')
  })
})
