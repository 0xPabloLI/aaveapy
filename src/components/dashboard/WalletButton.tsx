import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Eye, ChevronDown, X } from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'
import { WatchAddressInput } from './WatchAddressInput'
import { cn } from '@/lib/utils'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_DESKTOP_ACTIVE_CLASS,
  HEADER_CONTROL_DESKTOP_CLASS,
  HEADER_CONTROL_GROUP_GAP_CLASS,
  HEADER_CONTROL_ICON_CLASS,
  HEADER_CONTROL_MOBILE_CLASS,
  HEADER_CONTROL_POPOVER_ITEM_CLASS,
} from '@/lib/headerControlStyles'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface WalletButtonProps {
  mobile?: boolean
  onWatchSubmit?: (address: `0x${string}`) => void | Promise<void>
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WalletButton({ mobile = false, onWatchSubmit }: WalletButtonProps) {
  const { address, isConnected, isWatchMode, disconnect } = useWallet()
  const [showWatchInput, setShowWatchInput] = useState(false)

  if (showWatchInput && onWatchSubmit) {
    return (
      <WatchAddressInput
        onSubmit={async (addr) => {
          await onWatchSubmit(addr)
          setShowWatchInput(false)
        }}
        onCancel={() => setShowWatchInput(false)}
      />
    )
  }

  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => {
        return (
          <div {...(!mounted ? { className: 'opacity-0 pointer-events-none' } : {})}>
            {isConnected && address ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(mobile ? HEADER_CONTROL_MOBILE_CLASS : HEADER_CONTROL_DESKTOP_ACTIVE_CLASS)}
                    aria-label={isWatchMode ? `Viewing ${truncateAddress(address)}` : `Wallet ${truncateAddress(address)}`}
                  >
                    {isWatchMode ? (
                      <Eye className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                    )}
                    {!mobile && <span>{truncateAddress(address)}</span>}
                    {!mobile && (
                      <ChevronDown
                        className={cn(HEADER_CONTROL_AFFORDANCE_ICON_CLASS, 'text-muted-foreground')}
                        aria-hidden
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" sideOffset={4} className="w-40 p-1">
                  {!isWatchMode && onWatchSubmit && (
                    <button
                      type="button"
                      className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                      onClick={() => setShowWatchInput(true)}
                    >
                      <Eye className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                      Switch to watch mode
                    </button>
                  )}
                  {isWatchMode && (
                    <button
                      type="button"
                      className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                      onClick={() => setShowWatchInput(true)}
                    >
                      <Eye className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                      Switch address
                    </button>
                  )}
                  <button
                    type="button"
                    className={cn(HEADER_CONTROL_POPOVER_ITEM_CLASS, 'text-destructive')}
                    onClick={() => disconnect()}
                  >
                    <X className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                    Disconnect
                  </button>
                </PopoverContent>
              </Popover>
            ) : mobile && onWatchSubmit ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={HEADER_CONTROL_MOBILE_CLASS} aria-label="Wallet actions">
                    <Wallet className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" sideOffset={4} className="w-40 p-1">
                  <button
                    type="button"
                    className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                    onClick={openConnectModal}
                    aria-label="Connect wallet"
                  >
                    <Wallet className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                    Connect
                  </button>
                  <button
                    type="button"
                    className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                    onClick={() => setShowWatchInput(true)}
                    aria-label="View address"
                  >
                    <Eye className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
                    View address
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <div className={cn('flex items-center', !mobile && onWatchSubmit && HEADER_CONTROL_GROUP_GAP_CLASS)}>
                <button
                  type="button"
                  onClick={openConnectModal}
                  className={mobile ? HEADER_CONTROL_MOBILE_CLASS : HEADER_CONTROL_DESKTOP_CLASS}
                  aria-label="Connect wallet"
                >
                  <Wallet className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                  {!mobile && <span>Connect</span>}
                </button>
                {!mobile && onWatchSubmit && (
                  <button
                    type="button"
                    onClick={() => setShowWatchInput(true)}
                    className={HEADER_CONTROL_DESKTOP_CLASS}
                    aria-label="View address"
                  >
                    <Eye className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                    <span>View address</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
