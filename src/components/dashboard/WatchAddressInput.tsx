import { useState, useEffect, useCallback } from 'react'
import { useEnsName } from 'wagmi'

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

  const resolvedAddress = ensAddress ?? (isValidAddress ? input as `0x${string}` : null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const addr = ensAddress ?? (isValidAddress ? input as `0x${string}` : null)
      if (addr && ETH_ADDRESS_RE.test(addr)) {
        setError(false)
        onSubmit(addr as `0x${string}`)
      } else {
        setError(true)
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }, [input, isValidAddress, ensAddress, onSubmit, onCancel])

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(false) }}
        onKeyDown={handleKeyDown}
        placeholder="0x... or name.eth"
        autoFocus={autoFocus}
        aria-invalid={error || undefined}
        className={cn(
          'ds-text-11 h-7 w-48 rounded-md border bg-background px-2 outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          error ? 'border-destructive text-destructive' : 'border-border text-foreground',
        )}
      />
      {ensLoading && (
        <span className="ds-text-10 text-muted-foreground animate-pulse">resolving…</span>
      )}
      {resolvedAddress && !ensLoading && input.endsWith('.eth') && (
        <span className="ds-text-10 text-muted-foreground truncate max-w-24">{resolvedAddress.slice(0, 10)}…</span>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
