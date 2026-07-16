// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Header from './Header'
import { useWallet } from '@/hooks/useWallet'
import { useWatchModeConnect } from '@/hooks/useWatchModeConnect'

afterEach(cleanup)

const mockConnectWatchAddress = vi.fn()

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: Record<string, unknown>) => React.ReactNode }) =>
      children({ openConnectModal: vi.fn(), mounted: true }),
  },
}))

vi.mock('wagmi', () => ({
  useEnsAddress: () => ({ data: null, isLoading: false }),
  createConfig: vi.fn(() => ({})),
  fallback: vi.fn(() => ({})),
  http: vi.fn(() => ({})),
}))

vi.mock('wagmi/connectors', () => ({
  injected: vi.fn(() => ({})),
  walletConnect: vi.fn(() => ({})),
}))

vi.mock('@/lib/wagmi/config', () => ({
  wagmiConfig: {},
  WALLET_SUPPORTED_CHAINS: { id: 1, name: 'Ethereum' },
}))

vi.mock('@/components/ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

vi.mock('@/hooks/useWallet')
vi.mock('@/hooks/useWatchModeConnect')

function mockDisconnectedWallet() {
  vi.mocked(useWallet).mockReturnValue({
    address: undefined,
    chainId: 1,
    isConnected: false,
    isWatchMode: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as ReturnType<typeof useWallet>)
}

describe('Header', () => {
  it('connects Watch Mode from the desktop View address entry', () => {
    mockDisconnectedWallet()
    vi.mocked(useWatchModeConnect).mockReturnValue({
      connectWatchAddress: mockConnectWatchAddress,
    })

    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /view address/i }))
    fireEvent.change(screen.getByPlaceholderText(/0x/i), {
      target: { value: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText(/0x/i), { key: 'Enter' })

    expect(mockConnectWatchAddress).toHaveBeenCalledWith('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
  })
})
