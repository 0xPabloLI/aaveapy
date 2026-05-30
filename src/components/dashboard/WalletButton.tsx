import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Eye, ChevronDown, X } from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'
import { WatchAddressInput } from './WatchAddressInput'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface WalletButtonProps {
  mobile?: boolean
  onWatchSubmit?: (address: `0x${string}`) => void
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function WalletButton({ mobile = false, onWatchSubmit }: WalletButtonProps) {
  const { address, isConnected, isWatchMode, disconnect } = useWallet()
  const [showWatchInput, setShowWatchInput] = useState(false)

  if (showWatchInput && onWatchSubmit) {
    return (
      <WatchAddressInput
        onSubmit={(addr) => {
          onWatchSubmit(addr)
          setShowWatchInput(false)
        }}
        onCancel={() => setShowWatchInput(false)}
      />
    )
  }

  return (
    <ConnectButton.Custom>
      {({ account, openConnectModal, mounted }) => {
        const connected = mounted && account
        return (
          <div {...(!mounted ? { className: 'opacity-0 pointer-events-none' } : {})}>
            {connected && address ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 transition-colors',
                      mobile
                        ? 'justify-center w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full bg-card/60 border border-border/40 text-muted-foreground hover:bg-muted/60 hover:border-border focus-visible:ring-2 focus-visible:ring-ring'
                        : 'rounded-md px-2 py-1 ds-text-11 text-foreground hover:bg-muted/60',
                    )}
                    aria-label={isWatchMode ? `Viewing ${truncateAddress(address)}` : `Wallet ${truncateAddress(address)}`}
                  >
                    {isWatchMode ? (
                      <Eye className="w-3.5 h-3.5" aria-hidden />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                    )}
                    {!mobile && <span>{truncateAddress(address)}</span>}
                    {!mobile && <ChevronDown className="w-3 h-3 text-muted-foreground" aria-hidden />}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" sideOffset={4} className="w-40 p-1">
                  {isWatchMode && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 ds-text-11 hover:bg-muted/60"
                      onClick={() => setShowWatchInput(true)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Switch address
                    </button>
                  )}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 ds-text-11 hover:bg-muted/60 text-destructive"
                    onClick={() => disconnect()}
                  >
                    <X className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <button
                type="button"
                onClick={openConnectModal}
                className={cn(
                  'flex items-center gap-1 transition-colors',
                  mobile
                    ? 'justify-center w-[var(--ds-control-h)] h-[var(--ds-control-h)] rounded-full bg-card/60 border border-border/40 text-muted-foreground hover:bg-muted/60 hover:border-border focus-visible:ring-2 focus-visible:ring-ring'
                    : 'rounded-md px-2 py-1 ds-text-11 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                aria-label="Connect wallet"
              >
                <Wallet className="w-3.5 h-3.5" aria-hidden />
                {!mobile && <span>Connect</span>}
              </button>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
