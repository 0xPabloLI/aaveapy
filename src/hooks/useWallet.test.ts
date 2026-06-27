// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWallet } from './useWallet'

const mockDisconnect = vi.fn()
const mockDisconnectAsync = vi.fn()
const mockConnect = vi.fn()

let mockAccount: {
  address?: `0x${string}`
  chainId?: number
  isConnected: boolean
  connector?: { id: string; name: string }
}

vi.mock('wagmi', () => ({
  useAccount: () => mockAccount,
  useDisconnect: () => ({
    disconnect: mockDisconnect,
    disconnectAsync: mockDisconnectAsync,
  }),
  useConnect: () => ({ connect: mockConnect }),
  useConnections: () => [],
  useConfig: () => ({}),
}))

vi.mock('@wagmi/core', () => ({
  disconnect: vi.fn(),
}))

beforeEach(() => {
  mockAccount = {
    address: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    isConnected: true,
    connector: { id: 'injected', name: 'MetaMask' },
  }
  mockDisconnect.mockReset()
  mockDisconnectAsync.mockReset()
  mockConnect.mockReset()
})

describe('useWallet', () => {
  it('returns address, chainId, isConnected from useAccount', () => {
    const { result } = renderHook(() => useWallet())
    expect(result.current.address).toBe('0x1234567890123456789012345678901234567890')
    expect(result.current.chainId).toBe(1)
    expect(result.current.isConnected).toBe(true)
  })

  it('isWatchMode is true when connector id is watchMode', () => {
    mockAccount = {
      ...mockAccount,
      connector: { id: 'watchMode', name: 'View any address' },
    }
    const { result } = renderHook(() => useWallet())
    expect(result.current.isWatchMode).toBe(true)
  })

  it('isWatchMode is false for real wallet connector', () => {
    const { result } = renderHook(() => useWallet())
    expect(result.current.isWatchMode).toBe(false)
  })

  it('exposes disconnect from wagmi', () => {
    mockAccount = {
      isConnected: false,
      connector: undefined,
    }
    const { result } = renderHook(() => useWallet())
    act(() => { result.current.disconnect() })
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
