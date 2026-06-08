// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

vi.mock('wagmi', () => ({
  useEnsAddress: () => ({ data: null, isLoading: false }),
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

  it('lets desktop users enter a view address flow', () => {
    const onWatchSubmit = vi.fn()
    render(<WalletButton onWatchSubmit={onWatchSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /view address/i }))
    fireEvent.change(screen.getByPlaceholderText(/0x/i), {
      target: { value: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText(/0x/i), { key: 'Enter' })

    expect(onWatchSubmit).toHaveBeenCalledWith('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
  })

  it('returns to the wallet control after a successful watch import', async () => {
    const onWatchSubmit = vi.fn(async () => undefined)
    render(<WalletButton onWatchSubmit={onWatchSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /view address/i }))
    fireEvent.change(screen.getByPlaceholderText(/0x/i), {
      target: { value: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText(/0x/i), { key: 'Enter' })

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/watch wallet address/i)).not.toBeInTheDocument()
  })

  it('renders as circular button on mobile', () => {
    render(<WalletButton mobile />)
    const btn = screen.getByLabelText(/connect/i)
    expect(btn.className).toContain('rounded-full')
  })

  it('uses one mobile wallet actions menu for connect and view address', () => {
    render(<WalletButton mobile onWatchSubmit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /wallet actions/i }))

    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view address/i })).toBeInTheDocument()
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
    const { container } = render(<WalletButton onWatchSubmit={vi.fn()} />)
    const dot = container.querySelector('[class*="bg-emerald"]')
    expect(dot).toBeTruthy()
  })

  it('shows unified popover menu with Switch wallet, View another address, and Disconnect', () => {
    render(<WalletButton onWatchSubmit={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/wallet/i))

    expect(screen.getByRole('button', { name: /switch wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view another address/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
})

describe('WalletButton — chevron affordance (connected, desktop)', () => {
  beforeEach(() => mockWallet({
    address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    isConnected: true,
    isWatchMode: false,
  }))

  it('renders a chevron icon on desktop trigger', () => {
    const { container } = render(<WalletButton />)
    const trigger = screen.getByLabelText(/wallet/i)
    const chevron = trigger.querySelector('svg.lucide-chevron-down')
    expect(chevron).toBeTruthy()
  })

  it('chevron inherits parent color (no hardcoded text-muted-foreground) and has rotation transition wired', () => {
    const trigger = screen.getByLabelText(/wallet/i) ?? render(<WalletButton />).container
    const { container } = render(<WalletButton />)
    const chevron = container.querySelector('svg.lucide-chevron-down') as SVGElement
    expect(chevron).toBeTruthy()
    const cls = chevron.getAttribute('class') ?? ''
    expect(cls).not.toContain('text-muted-foreground')
    expect(cls).toContain('transition-transform')
    expect(cls).toContain('group-data-[state=open]:rotate-180')
    expect(cls).toContain('opacity-60')
  })

  it('trigger button carries the `group` class so chevron rotation responds to data-state', () => {
    render(<WalletButton />)
    const trigger = screen.getByLabelText(/wallet/i)
    expect(trigger.className).toContain('group')
  })

  it('trigger flips data-state to open after click (drives chevron rotation)', () => {
    render(<WalletButton />)
    const trigger = screen.getByLabelText(/wallet/i)
    expect(trigger.getAttribute('data-state')).toBe('closed')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('data-state')).toBe('open')
  })

  it('does NOT render the chevron on mobile (circular icon-only trigger)', () => {
    const { container } = render(<WalletButton mobile />)
    expect(container.querySelector('svg.lucide-chevron-down')).toBeNull()
  })
})

  it('Switch wallet opens RainbowKit connect modal', () => {
    mockOpenConnectModal.mockClear()
    render(<WalletButton onWatchSubmit={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/wallet/i))
    fireEvent.click(screen.getByRole('button', { name: /switch wallet/i }))

    expect(mockOpenConnectModal).toHaveBeenCalled()
  })

  it('shows Switch wallet and Disconnect even without onWatchSubmit', () => {
    render(<WalletButton />)

    fireEvent.click(screen.getByLabelText(/wallet/i))

    expect(screen.getByRole('button', { name: /switch wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view another address/i })).not.toBeInTheDocument()
  })

  it('View another address opens address input flow', () => {
    const onWatchSubmit = vi.fn(async () => undefined)
    render(<WalletButton onWatchSubmit={onWatchSubmit} />)

    fireEvent.click(screen.getByLabelText(/wallet/i))
    fireEvent.click(screen.getByRole('button', { name: /view another address/i }))

    expect(screen.getByPlaceholderText(/0x/i)).toBeInTheDocument()
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
    const { container } = render(<WalletButton />)
    const trigger = screen.getByLabelText(/viewing/i)
    expect(trigger.querySelector('[class*="bg-emerald"]')).not.toBeTruthy()
  })

  it('shows unified popover menu identical to wallet connected state', () => {
    render(<WalletButton onWatchSubmit={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/viewing/i))

    expect(screen.getByRole('button', { name: /switch wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view another address/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })
})
