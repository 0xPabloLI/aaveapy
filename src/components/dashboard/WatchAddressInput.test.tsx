// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { WatchAddressInput } from './WatchAddressInput'

afterEach(cleanup)

vi.mock('wagmi', () => ({
  useEnsName: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

describe('WatchAddressInput', () => {
  it('renders an input with placeholder text', () => {
    render(<WatchAddressInput onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText(/0x/i)).toBeInTheDocument()
  })

  it('calls onSubmit with valid ethereum address on Enter', () => {
    const onSubmit = vi.fn()
    render(<WatchAddressInput onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByPlaceholderText(/0x/i)
    fireEvent.change(input, { target: { value: '0x1234567890abcdef1234567890abcdef12345678' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678')
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
})
