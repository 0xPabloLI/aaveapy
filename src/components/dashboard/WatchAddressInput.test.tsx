// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WatchAddressInput } from './WatchAddressInput'
import {
  HEADER_CONTROL_FOCUS_RING_CLASS,
  HEADER_CONTROL_INPUT_CLASS,
  HEADER_CONTROL_ICON_BUTTON_CLASS,
} from '@/lib/headerControlStyles'

afterEach(cleanup)

vi.mock('wagmi', () => ({
  useEnsAddress: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('WatchAddressInput', () => {
  it('renders an input with placeholder text', () => {
    render(<WatchAddressInput onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText(/0x/i)).toBeInTheDocument()
  })

  it('calls onSubmit with valid ethereum address on Enter', async () => {
    const onSubmit = vi.fn()
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByPlaceholderText(/0x/i)
    fireEvent.change(input, { target: { value: '0x1234567890abcdef1234567890abcdef12345678' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678')
    })
  })

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn()
    render(<WatchAddressInput onSubmit={vi.fn()} onCancel={onCancel} />)
    const input = screen.getByPlaceholderText(/0x/i)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not call onSubmit for invalid address on Enter', () => {
    const onSubmit = vi.fn()
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByPlaceholderText(/0x/i)
    fireEvent.change(input, { target: { value: 'not-an-address' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows error state for invalid input', () => {
    render(<WatchAddressInput onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByPlaceholderText(/0x/i)
    fireEvent.change(input, { target: { value: 'invalid' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows importing then connected status after clicking confirm', async () => {
    const onSubmit = vi.fn(async () => undefined)
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/watch wallet address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm watch address/i }))

    expect(await screen.findByText(/Watch mode connected/i)).toBeInTheDocument()
    expect(screen.getByText(/listening to 0x1234…5678/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /re-import watch address/i })).not.toBeInTheDocument()
  })

  it('keeps loading visible while switching to Watch mode', async () => {
    let resolveSubmit!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve }))
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/watch wallet address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm watch address/i }))

    expect(screen.getByText(/Switching to Watch mode for 0x1234…5678/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/watch wallet address/i)).toBeDisabled()

    resolveSubmit()
    await screen.findByText(/Watch mode connected/i)
  })

  it('shows failure reason and supports re-import', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Watch connector unavailable'))
      .mockResolvedValueOnce(undefined)
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/watch wallet address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm watch address/i }))

    expect(await screen.findByText('Watch connector unavailable')).toBeInTheDocument()
    const reimportBtn = screen.getByRole('button', { name: /re-import watch address/i })
    expect(reimportBtn).toBeInTheDocument()
    expect(reimportBtn).toHaveAttribute('title', 'Retry importing the previously entered address after a connection failure')
    fireEvent.click(reimportBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Watch mode connected/i)).toBeInTheDocument()
  })

  it('shows inline help hint next to Re-import on failure', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('network'))
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/watch wallet address/i), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm watch address/i }))

    expect(await screen.findByText('network')).toBeInTheDocument()
    const helpIcon = screen.getByTitle('Available only when the previous import failed')
    expect(helpIcon).toBeInTheDocument()
  })

  it('reuses header-control border and focus tokens for input and actions', () => {
    render(<WatchAddressInput onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByLabelText(/watch wallet address/i)
    const confirm = screen.getByRole('button', { name: /confirm watch address/i })
    const cancel = screen.getByRole('button', { name: /cancel/i })

    for (const token of HEADER_CONTROL_INPUT_CLASS.split(' ')) {
      expect(input.className).toContain(token)
    }
    for (const token of HEADER_CONTROL_FOCUS_RING_CLASS.split(' ')) {
      expect(input.className).toContain(token)
    }
    for (const token of HEADER_CONTROL_ICON_BUTTON_CLASS.split(' ')) {
      expect(confirm.className).toContain(token)
      expect(cancel.className).toContain(token)
    }

    expect(input.className).toContain('border-border/40')
    expect(input.className).not.toContain('rounded-md')
  })
})
