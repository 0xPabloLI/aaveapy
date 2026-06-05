import { useState, useEffect, useCallback } from 'react'
import { useEnsName } from 'wagmi'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_FOCUS_RING_CLASS,
} from '@/lib/headerControlStyles'

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const ENS_DEBOUNCE_MS = 300

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface WatchAddressInputProps {
  onSubmit: (address: `0x${string}`) => void
  onCancel: () => void
  autoFocus?: boolean
}

export function WatchAddressInput({ onSubmit, onCancel, autoFocus = true }: WatchAddressInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const isValidAddress = ETH_ADDRESS_RE.test(input)
  const debouncedEnsInput = useDebouncedValue(input.endsWith('.eth') ? input : '', ENS_DEBOUNCE_MS)

  const { data: ensAddress, isLoading: ensLoading } = useEnsName({
    name: debouncedEnsInput || undefined,
  })

  const resolvedAddress =
    (ensAddress as `0x${string}` | undefined) ?? (isValidAddress ? (input as `0x${string}`) : null)
  const canSubmit = !!resolvedAddress && ETH_ADDRESS_RE.test(resolvedAddress) && !ensLoading

  const handleSubmit = useCallback(() => {
    if (canSubmit && resolvedAddress) {
      setError(false)
      onSubmit(resolvedAddress)
    } else {
      setError(true)
    }
  }, [canSubmit, resolvedAddress, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel],
  )

  // Shared circular icon button (mirrors HEADER_CONTROL_MOBILE_CLASS geometry,
  // sized to fit alongside the input).
  const iconBtn = cn(
    'flex items-center justify-center w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full',
    'bg-card/60 border border-border/40 text-muted-foreground',
    'hover:bg-muted/60 hover:border-border transition-colors',
    'disabled:opacity-40 disabled:hover:bg-card/60 disabled:hover:border-border/40',
    HEADER_CONTROL_FOCUS_RING_CLASS,
  )

  return (
    <div className="flex items-center gap-[var(--ds-space-1)]">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setError(false)
        }}
        onKeyDown={handleKeyDown}
        placeholder="0x… or name.eth"
        autoFocus={autoFocus}
        aria-invalid={error || undefined}
        aria-label="Watch wallet address"
        className={cn(
          'ds-text-14 h-[var(--ds-control-h)] w-56 rounded-md border bg-background px-[var(--ds-space-2)] outline-none',
          HEADER_CONTROL_FOCUS_RING_CLASS,
          error ? 'border-destructive text-destructive' : 'border-border text-foreground',
        )}
      />
      {ensLoading && (
        <span className="ds-text-10 text-muted-foreground animate-pulse">resolving…</span>
      )}
      {resolvedAddress && !ensLoading && input.endsWith('.eth') && (
        <span className="ds-text-10 text-muted-foreground truncate max-w-24">
          {resolvedAddress.slice(0, 10)}…
        </span>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(iconBtn, canSubmit && 'text-emerald-500 hover:text-emerald-600')}
        aria-label="Confirm watch address"
        title="Confirm (Enter)"
      >
        <Check className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={iconBtn}
        aria-label="Cancel"
        title="Cancel (Esc)"
      >
        <X className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
      </button>
    </div>
  )
}
