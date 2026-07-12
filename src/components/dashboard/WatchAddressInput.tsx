import { useState, useCallback } from 'react'
import { Check, Info, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cnDsInputSurface } from '@/lib/dsInputSurface'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_ERROR_CLASS,
  HEADER_CONTROL_ICON_BUTTON_CLASS,
  HEADER_CONTROL_STATUS_ACTION_CLASS,
} from '@/lib/headerControlStyles'
import { toast } from 'sonner'

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function formatShortAddress(addr: `0x${string}`) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

interface WatchAddressInputProps {
  onSubmit: (address: `0x${string}`) => void | Promise<void>
  onCancel: () => void
  autoFocus?: boolean
}

type WatchStatus = 'idle' | 'importing' | 'connected' | 'error'

export function WatchAddressInput({ onSubmit, onCancel, autoFocus = true }: WatchAddressInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [status, setStatus] = useState<WatchStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [lastSubmittedAddress, setLastSubmittedAddress] = useState<`0x${string}` | null>(null)

  const hasValue = input.trim().length > 0
  const isValidAddress = ETH_ADDRESS_RE.test(input)
  const resolvedAddress = isValidAddress ? (input as `0x${string}`) : null
  const canSubmit = !!resolvedAddress

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
      setStatusMessage(`Connected · viewing ${shortAddress}`)
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
      setStatusMessage('Enter a valid 0x address')
    }
  }, [canSubmit, resolvedAddress, submitAddress])

  const handleRetry = useCallback(() => {
    const retryAddress = lastSubmittedAddress ?? resolvedAddress
    if (!retryAddress) {
      setError(true)
      setStatus('error')
      setStatusMessage('Enter a valid 0x address')
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
  const hasStatusMessage = status !== 'idle'

  return (
    <div className="relative flex items-center gap-[var(--ds-space-1)]" data-watch-status={status}>
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setError(false)
          setStatus('idle')
          setStatusMessage('')
        }}
        onKeyDown={handleKeyDown}
        placeholder="0x…"
        autoFocus={autoFocus}
        disabled={isImporting}
        aria-invalid={error || undefined}
        aria-label="Watch wallet address"
        className={cn(
          'h-[var(--ds-control-h)] w-52 sm:w-56 ds-text-14 px-[var(--ds-space-3)]',
          cnDsInputSurface(hasValue, 'neutral'),
          error && HEADER_CONTROL_ERROR_CLASS,
        )}
      />
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
      {hasStatusMessage && (
        <span className={cn(
          'absolute top-full left-0 mt-1 ds-text-11',
          status === 'error' ? 'text-destructive' : status === 'connected' ? 'text-success' : 'text-muted-foreground',
        )} role="status">
          {statusMessage}
          {showRetry && (
            <span className="inline-flex items-center gap-[var(--ds-space-1)] ml-1">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isImporting}
                className={HEADER_CONTROL_STATUS_ACTION_CLASS}
                aria-label="Re-import watch address"
                title="Retry importing the previously entered address after a connection failure"
              >
                <span className="inline-flex items-center gap-[var(--ds-space-1)]">
                  <RotateCcw className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
                  Re-import
                </span>
              </button>
              <span
                className="inline-flex items-center gap-[var(--ds-space-0-5)] text-muted-foreground/60"
                title="Available only when the previous import failed"
              >
                <Info className="w-3 h-3" aria-hidden />
                <span className="sr-only">Why is Re-import shown?</span>
              </span>
            </span>
          )}
        </span>
      )}
    </div>
  )
}
