// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WalletButton } from './WalletButton'
import { useWallet } from '@/hooks/useWallet'

afterEach(cleanup)

const mockOpenConnectModal = vi.fn()

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: Record<string, unknown>) => React.ReactNode }) =>
      children({ openConnectModal: mockOpenConnectModal, mounted: true }),
  },
}))

vi.mock('@/hooks/useWallet')

function mockWallet(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  vi.mocked(useWallet).mockReturnValue({
    address: undefined,
    chainId: 1,
    isConnected: false,
    isWatchMode: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useWallet>)
}

describe('WalletButton — disconnected', () => {
  beforeEach(() => mockWallet())

  it('renders a connect button', () => {
    render(<WalletButton />)
    expect(screen.getByLabelText(/connect/i)).toBeInTheDocument()
  })

  it('renders as circular button on mobile', () => {
    render(<WalletButton mobile />)
    const btn = screen.getByLabelText(/connect/i)
    expect(btn.className).toContain('rounded-full')
  })
})

describe('WalletButton — wallet connected (non-watch)', () => {
  beforeEach(() => mockWallet({
    address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    isConnected: true,
    isWatchMode: false,
  }))

  it('renders wallet label with truncated address', () => {
    render(<WalletButton />)
    expect(screen.getByLabelText(/wallet 0x1234/i)).toBeInTheDocument()
  })

  it('renders green dot indicator', () => {
    render(<WalletButton />)
    const trigger = screen.getByLabelText(/wallet/i)
    expect(trigger.querySelector('.bg-emerald-500')).toBeInTheDocument()
  })
})

describe('WalletButton — watch mode connected', () => {
  beforeEach(() => mockWallet({
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
    isConnected: true,
    isWatchMode: true,
  }))

  it('renders viewing label with Eye icon', () => {
    render(<WalletButton />)
    expect(screen.getByLabelText(/viewing 0xabcd/i)).toBeInTheDocument()
  })

  it('does not render green dot (uses Eye instead)', () => {
    render(<WalletButton />)
    const trigger = screen.getByLabelText(/viewing/i)
    expect(trigger.querySelector('.bg-emerald-500')).not.toBeInTheDocument()
  })
})
