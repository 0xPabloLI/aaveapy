// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchModeConnect } from './useWatchModeConnect'

const mockConnect = vi.fn()
const mockSetWatchAddress = vi.fn()

vi.mock('wagmi', () => ({
  useConnect: () => ({
    connect: mockConnect,
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
  it('sets the watched address before connecting Watch Mode', () => {
    const { result } = renderHook(() => useWatchModeConnect())
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

    act(() => result.current.connectWatchAddress(address))

    expect(mockSetWatchAddress).toHaveBeenCalledWith(address)
    expect(mockConnect).toHaveBeenCalledWith({
      connector: expect.objectContaining({ id: 'watchMode' }),
    })
  })
})
