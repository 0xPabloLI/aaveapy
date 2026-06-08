// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchModeConnect } from './useWatchModeConnect'

const mockConnect = vi.fn()
const mockConnectAsync = vi.fn(() => Promise.resolve())
const mockSetWatchAddress = vi.fn()
const mockInvalidateQueries = vi.fn(() => Promise.resolve())
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

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

describe('useWatchModeConnect', () => {
  beforeEach(() => {
    mockActiveConnector = undefined
    mockConnect.mockClear()
    mockConnectAsync.mockClear()
    mockSetWatchAddress.mockClear()
    mockInvalidateQueries.mockClear()
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
    // First-time connect: must NOT invalidate, the connect itself triggers
    // a fresh fetch via the address-keyed query becoming enabled.
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('re-submitting an address while Watch Mode is active invalidates the user-positions query (AAV-643 regression)', async () => {
    // Reproduce: after page refresh, wagmi auto-restores the watchMode
    // connector from localStorage. The user re-enters the same address
    // expecting positions to reload. The previous early-return made this
    // a silent no-op — invalidate the query so React Query refetches.
    mockActiveConnector = { id: 'watchMode' }
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await act(() => result.current.connectWatchAddress(address))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-positions', address],
    })
    // Re-entry MUST NOT call connectAsync (the connector is already active;
    // calling it would throw "Connector already connected" and waste a round-trip).
    expect(mockConnectAsync).not.toHaveBeenCalled()
  })

  it('re-submitting a DIFFERENT address while Watch Mode is active also invalidates the user-positions query', async () => {
    mockActiveConnector = { id: 'watchMode' }
    const { result } = renderHook(() => useWatchModeConnect())
    const newAddress = '0x1111111111111111111111111111111111111111' as const

    await act(() => result.current.connectWatchAddress(newAddress))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(newAddress)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-positions', newAddress],
    })
  })

  it('treats duplicate Watch Mode connection errors as already successful', async () => {
    mockConnectAsync.mockRejectedValueOnce(new Error('Connector already connected. Version: @wagmi/core@3.5.0'))
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await expect(act(() => result.current.connectWatchAddress(address))).resolves.toBeUndefined()

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
  })
})
