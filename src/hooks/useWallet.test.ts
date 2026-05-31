import { describe, expect, it, vi } from 'vitest'
import { useWallet } from './useWallet'
import type { UseAccountReturnType, UseDisconnectReturnType, UseConnectReturnType } from 'wagmi'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useDisconnect: vi.fn(),
  useConnect: vi.fn(),
}))

import { useAccount, useDisconnect, useConnect } from 'wagmi'

const makeAccount = (overrides: Partial<UseAccountReturnType> = {}): UseAccountReturnType =>
  ({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    isConnected: true,
    connector: { id: 'injected', name: 'MetaMask' },
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: 'connected',
    ...overrides,
  }) as UseAccountReturnType

const makeDisconnect = (fn = vi.fn()): UseDisconnectReturnType =>
  ({ disconnect: fn }) as UseDisconnectReturnType

const makeConnect = (): UseConnectReturnType =>
  ({ connect: vi.fn() }) as UseConnectReturnType

describe('useWallet', () => {
  it('returns address, chainId, isConnected from useAccount', () => {
    vi.mocked(useAccount).mockReturnValue(makeAccount())
    vi.mocked(useDisconnect).mockReturnValue(makeDisconnect())
    vi.mocked(useConnect).mockReturnValue(makeConnect())

    const result = useWallet()
    expect(result.address).toBe('0x1234567890123456789012345678901234567890')
    expect(result.chainId).toBe(1)
    expect(result.isConnected).toBe(true)
  })

  it('isWatchMode is true when connector id is watchMode', () => {
    vi.mocked(useAccount).mockReturnValue(
      makeAccount({ connector: { id: 'watchMode', name: 'View any address' } }),
    )
    vi.mocked(useDisconnect).mockReturnValue(makeDisconnect())
    vi.mocked(useConnect).mockReturnValue(makeConnect())

    const result = useWallet()
    expect(result.isWatchMode).toBe(true)
  })

  it('isWatchMode is false for real wallet connector', () => {
    vi.mocked(useAccount).mockReturnValue(makeAccount())
    vi.mocked(useDisconnect).mockReturnValue(makeDisconnect())
    vi.mocked(useConnect).mockReturnValue(makeConnect())

    const result = useWallet()
    expect(result.isWatchMode).toBe(false)
  })

  it('exposes disconnect from wagmi', () => {
    const mockDisconnect = vi.fn()
    vi.mocked(useAccount).mockReturnValue(
      makeAccount({
        address: undefined,
        isConnected: false,
        connector: undefined,
        isDisconnected: true,
        status: 'disconnected',
      }),
    )
    vi.mocked(useDisconnect).mockReturnValue(makeDisconnect(mockDisconnect))
    vi.mocked(useConnect).mockReturnValue(makeConnect())

    const result = useWallet()
    result.disconnect()
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
