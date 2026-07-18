import { useEffect, useRef, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Eye, ChevronDown, X, Copy, Check } from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'
import { WatchAddressInput } from './WatchAddressInput'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { wagmiConfig } from '@/lib/wagmi/config'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_DESKTOP_ACTIVE_CLASS,
  HEADER_CONTROL_DESKTOP_CLASS,
  HEADER_CONTROL_GROUP_GAP_CLASS,
  HEADER_CONTROL_ICON_CLASS,
  HEADER_CONTROL_MOBILE_CLASS,
  HEADER_CONTROL_POPOVER_ITEM_CLASS,
  HEADER_CONTROL_TRANSITION_DURATION,
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
  const { address, isConnected, isWatchMode, disconnect, disconnectAllAsync } = useWallet()
  const [showWatchInput, setShowWatchInput] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState(false)
  const [copied, setCopied] = useState(false)
  const openConnectModalRef = useRef<(() => void) | null>(null)

  const handleCopy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied', {
        description: truncateAddress(address),
      })
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      toast.error('Failed to copy address')
    }
  }

  const handleSwitchWallet = async () => {
    setPendingSwitch(true)
    await disconnectAllAsync()
    await (wagmiConfig._internal as unknown as { store?: { removeItem: (key: string) => Promise<void> | void } }).store?.removeItem('recentConnectorId')
  }

  useEffect(() => {
    if (pendingSwitch && !isConnected) {
      setPendingSwitch(false)
      openConnectModalRef.current?.()
    }
  }, [pendingSwitch, isConnected])

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
        openConnectModalRef.current = openConnectModal

        return (
          <div {...(!mounted ? { className: 'opacity-0 pointer-events-none' } : {})}>
            {isConnected && address ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(mobile ? HEADER_CONTROL_MOBILE_CLASS : HEADER_CONTROL_DESKTOP_ACTIVE_CLASS, 'group')}
                    aria-label={isWatchMode ? `Viewing ${truncateAddress(address)}` : `Wallet ${truncateAddress(address)}`}
                  >
                    {isWatchMode ? (
                      <Eye className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                    ) : (
                      <Wallet className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
                    )}
                    {!mobile && <span>{truncateAddress(address)}</span>}
                    {!mobile && (
                      <ChevronDown
                        className={cn(
                           HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
                           `transition-transform ${HEADER_CONTROL_TRANSITION_DURATION}`,
                           'group-data-[state=open]:rotate-180',
                         )}
                        aria-hidden
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" sideOffset={4} className="w-40 p-1">
                  <button
                    type="button"
                    className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                    onClick={handleSwitchWallet}
                  >
                    <Wallet className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
                    Switch wallet
                  </button>
                  {onWatchSubmit && (
                    <button
                      type="button"
                      className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                      onClick={() => setShowWatchInput(true)}
                    >
                      <Eye className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
                      View another address
                    </button>
                  )}
                  <button
                    type="button"
                    className={HEADER_CONTROL_POPOVER_ITEM_CLASS}
                    onClick={handleCopy}
                  >
                    {copied
                      ? <Check className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
                      : <Copy className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
                    }
                    {copied ? 'Copied!' : 'Copy address'}
                  </button>
                  <button
                    type="button"
                    className={cn(HEADER_CONTROL_POPOVER_ITEM_CLASS, 'text-destructive')}
                    onClick={() => disconnect()}
                  >
                    <X className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} aria-hidden />
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
