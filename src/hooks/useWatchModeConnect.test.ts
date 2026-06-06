// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchModeConnect } from './useWatchModeConnect'

const mockConnect = vi.fn()
const mockConnectAsync = vi.fn(() => Promise.resolve())
const mockSetWatchAddress = vi.fn()
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

describe('useWatchModeConnect', () => {
  beforeEach(() => {
    mockActiveConnector = undefined
    mockConnect.mockClear()
    mockConnectAsync.mockClear()
    mockSetWatchAddress.mockClear()
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
  })

  it('updates the watched address without reconnecting when Watch Mode is already active', async () => {
    mockActiveConnector = { id: 'watchMode' }
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await act(() => result.current.connectWatchAddress(address))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
    expect(mockConnectAsync).not.toHaveBeenCalled()
  })

  it('treats duplicate Watch Mode connection errors as already successful', async () => {
    mockConnectAsync.mockRejectedValueOnce(new Error('Connector already connected. Version: @wagmi/core@3.5.0'))
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    await expect(act(() => result.current.connectWatchAddress(address))).resolves.toBeUndefined()

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
  })
})
