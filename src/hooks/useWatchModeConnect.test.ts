// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchModeConnect } from './useWatchModeConnect'

const mockConnect = vi.fn()
const mockConnectAsync = vi.fn(() => Promise.resolve())
const mockSetWatchAddress = vi.fn()
const mockBumpRefetch = vi.fn()
let mockActiveConnector: { id: string } | undefined

vi.mock('wagmi', () => ({
  useAccount: () => ({
    connector: mockActiveConnector,
  }),
  useConnect: () => ({
    connect: mockConnect,
    connectAsync: mockConnectAsync,
    connectors: [
      {
        id: 'watchMode',
        name: 'View any address',
        setWatchAddress: mockSetWatchAddress,
      },
    ],
  }),
}))

vi.mock('../lib/userData/refetchEvent', () => ({
  bumpRefetch: (...args: unknown[]) => mockBumpRefetch(...args),
}))

describe('useWatchModeConnect', () => {
  beforeEach(() => {
    mockActiveConnector = undefined
    mockConnect.mockClear()
    mockConnectAsync.mockClear()
    mockSetWatchAddress.mockClear()
    mockBumpRefetch.mockClear()
  })

  it('sets the watched address before connecting Watch Mode', async () => {
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await act(() => result.current.connectWatchAddress(address))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
    expect(mockConnectAsync).toHaveBeenCalledWith({
      connector: expect.objectContaining({ id: 'watchMode' }),
    })
    expect(mockConnect).not.toHaveBeenCalled()
    // First-time connect: must NOT bump refetch, the connect itself triggers
    // a fresh fetch via the address-keyed query becoming enabled.
    expect(mockBumpRefetch).not.toHaveBeenCalled()
  })

  it('re-submitting an address while Watch Mode is active bumps refetch with source=watch-reentry (AAV-643/679 regression)', async () => {
    // Reproduce: after page refresh, wagmi auto-restores the watchMode
    // connector from localStorage. The user re-enters the same address
    // expecting positions to reload. Routes through refetchEvent so the
    // refresh is unified with F5 / Refresh button (ADR-0015).
    mockActiveConnector = { id: 'watchMode' }
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await act(() => result.current.connectWatchAddress(address))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
    expect(mockBumpRefetch).toHaveBeenCalledWith('watch-reentry')
    expect(mockBumpRefetch).toHaveBeenCalledTimes(1)
    // Re-entry MUST NOT call connectAsync (the connector is already active;
    // calling it would throw "Connector already connected" and waste a round-trip).
    expect(mockConnectAsync).not.toHaveBeenCalled()
  })

  it('re-submitting a DIFFERENT address while Watch Mode is active also bumps refetch', async () => {
    mockActiveConnector = { id: 'watchMode' }
    const { result } = renderHook(() => useWatchModeConnect())
    const newAddress = '0x1111111111111111111111111111111111111111' as const

    await act(() => result.current.connectWatchAddress(newAddress))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(newAddress)
    expect(mockBumpRefetch).toHaveBeenCalledWith('watch-reentry')
  })

  it('treats duplicate Watch Mode connection errors as already successful', async () => {
    mockConnectAsync.mockRejectedValueOnce(new Error('Connector already connected. Version: @wagmi/core@3.5.0'))
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await expect(act(() => result.current.connectWatchAddress(address))).resolves.toBeUndefined()

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
  })
})
