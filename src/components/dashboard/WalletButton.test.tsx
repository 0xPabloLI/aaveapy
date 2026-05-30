// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { WalletButton } from './WalletButton'

afterEach(cleanup)

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: Record<string, unknown>) => React.ReactNode }) =>
      children({ account: undefined, openConnectModal: vi.fn(), mounted: true }),
  },
}))

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    address: undefined,
    chainId: 1,
    isConnected: false,
    isWatchMode: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

describe('WalletButton', () => {
  it('renders a connect button when not connected', () => {
    render(<WalletButton />)
    expect(screen.getByLabelText(/connect/i)).toBeInTheDocument()
  })

  it('renders wallet icon on connect button', () => {
    render(<WalletButton />)
    const btn = screen.getByLabelText(/connect/i)
    expect(btn.querySelector('svg')).toBeInTheDocument()
  })

  it('renders as circular button on mobile', () => {
    render(<WalletButton mobile />)
    const btn = screen.getByLabelText(/connect/i)
    expect(btn.className).toContain('rounded-full')
  })
})
