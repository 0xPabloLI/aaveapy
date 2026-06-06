import { useState, useEffect, useCallback } from 'react'
import { useEnsAddress } from 'wagmi'
import { Check, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_ERROR_CLASS,
  HEADER_CONTROL_ICON_BUTTON_CLASS,
  HEADER_CONTROL_INPUT_CLASS,
  HEADER_CONTROL_STATUS_ACTION_CLASS,
} from '@/lib/headerControlStyles'
import { toast } from 'sonner'

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
  onSubmit: (address: `0x${string}`) => void | Promise<void>
  onCancel: () => void
  autoFocus?: boolean
}

type WatchStatus = 'idle' | 'importing' | 'connected' | 'error'

function formatShortAddress(addr: `0x${string}`) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WatchAddressInput({ onSubmit, onCancel, autoFocus = true }: WatchAddressInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [status, setStatus] = useState<WatchStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('Enter an address to view it in Watch mode')
  const [lastSubmittedAddress, setLastSubmittedAddress] = useState<`0x${string}` | null>(null)

  const isValidAddress = ETH_ADDRESS_RE.test(input)
  const debouncedEnsInput = useDebouncedValue(input.endsWith('.eth') ? input : '', ENS_DEBOUNCE_MS)

  const { data: ensAddress, isLoading: ensLoading } = useEnsAddress({
    name: debouncedEnsInput || undefined,
  })

  const resolvedAddress =
    (ensAddress as `0x${string}` | undefined) ?? (isValidAddress ? (input as `0x${string}`) : null)
  const canSubmit = !!resolvedAddress && ETH_ADDRESS_RE.test(resolvedAddress) && !ensLoading

  const submitAddress = useCallback(async (address: `0x${string}`) => {
    const shortAddress = formatShortAddress(address)
    const toastId = toast.loading('Switching to Watch mode…')

    setError(false)
    setStatus('importing')
    setStatusMessage(`Switching to Watch mode for ${shortAddress}…`)
    setLastSubmittedAddress(address)

    try {
      await onSubmit(address)
      setStatus('connected')
      setStatusMessage(`Watch mode connected · listening to ${shortAddress}`)
      toast.success('Watch mode active', { id: toastId })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unable to switch to Watch mode'
      setError(true)
      setStatus('error')
      setStatusMessage(reason)
      toast.error('Failed to switch to Watch mode', { id: toastId, description: reason })
    }
  }, [onSubmit])

  const handleSubmit = useCallback(() => {
    if (canSubmit && resolvedAddress) {
      void submitAddress(resolvedAddress)
    } else {
      setError(true)
      setStatus('error')
      setStatusMessage('Enter a valid 0x address or resolved ENS name')
    }
  }, [canSubmit, resolvedAddress, submitAddress])

  const handleRetry = useCallback(() => {
    const retryAddress = lastSubmittedAddress ?? resolvedAddress
    if (!retryAddress) {
      setError(true)
      setStatus('error')
      setStatusMessage('Enter a valid 0x address or resolved ENS name')
      return
    }
    void submitAddress(retryAddress)
  }, [lastSubmittedAddress, resolvedAddress, submitAddress])

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

  const isImporting = status === 'importing'
  const showRetry = status === 'error'

  return (
    <div className="flex flex-col gap-[var(--ds-space-1)]" data-watch-status={status}>
      <div className="flex items-center gap-[var(--ds-space-1)]">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(false)
            setStatus('idle')
            setStatusMessage('Enter an address to view it in Watch mode')
          }}
          onKeyDown={handleKeyDown}
          placeholder="0x… or name.eth"
          autoFocus={autoFocus}
          disabled={isImporting}
          aria-invalid={error || undefined}
          aria-label="Watch wallet address"
          className={cn(
            HEADER_CONTROL_INPUT_CLASS,
            'w-52 sm:w-56 text-foreground',
            error && HEADER_CONTROL_ERROR_CLASS,
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
          disabled={!canSubmit || isImporting}
          className={cn(HEADER_CONTROL_ICON_BUTTON_CLASS, canSubmit && !isImporting && 'text-success hover:text-success')}
          aria-label="Confirm watch address"
          title="Confirm (Enter)"
        >
          {isImporting ? (
            <Loader2 className={cn(HEADER_CONTROL_AFFORDANCE_ICON_CLASS, 'animate-spin')} aria-hidden />
          ) : (
            <Check className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isImporting}
          className={HEADER_CONTROL_ICON_BUTTON_CLASS}
          aria-label="Cancel"
          title="Cancel (Esc)"
        >
          <X className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
        </button>
      </div>
      <div className="flex min-h-[1rem] items-center gap-[var(--ds-space-1)] pl-[var(--ds-space-3)] ds-text-11 text-muted-foreground" role="status">
        <span className={cn(status === 'error' && 'text-destructive', status === 'connected' && 'text-success')}>
          {statusMessage}
        </span>
        {showRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isImporting}
            className={HEADER_CONTROL_STATUS_ACTION_CLASS}
            aria-label="Re-import watch address"
          >
            <span className="inline-flex items-center gap-[var(--ds-space-1)]">
              <RotateCcw className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
              Re-import
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
