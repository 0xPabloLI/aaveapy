// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchModeConnect } from './useWatchModeConnect'

const mockConnect = vi.fn()
const mockConnectAsync = vi.fn(() => Promise.resolve())
const mockSetWatchAddress = vi.fn()

vi.mock('wagmi', () => ({
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
})
