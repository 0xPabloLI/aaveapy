import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { WalletLoadState, DegradedResult } from '@/hooks/useUserPositionsSdk'
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation'
import type { ReserveWithSpread } from '@/types/aave'
import { convertWalletPositionsToEntries } from '@/lib/walletPositionToPortfolio'

interface UseWalletAutoImportParams {
  address: `0x${string}` | undefined
  isConnected: boolean
  walletLoadState: WalletLoadState
  walletResult: DegradedResult
  v3SdkFailed: boolean
  v4SdkFailed: boolean
  reserves: ReserveWithSpread[]
  portfolioActions: PortfolioSimulationActions
  /** Called when wallet positions are successfully imported (non-empty). */
  onImport?: () => void
  /** Called when wallet disconnects, after wallet entries are removed. */
  onDisconnect?: () => void
}

export function useWalletAutoImport({
  address,
  isConnected,
  walletLoadState,
  walletResult,
  v3SdkFailed,
  v4SdkFailed,
  reserves,
  portfolioActions,
  onImport,
  onDisconnect,
}: UseWalletAutoImportParams) {
  const lastImportedAddress = useRef<string | null>(null)
  const lastDegradedShown = useRef(false)
  const wasConnected = useRef(false)

  useEffect(() => {
    if (!isConnected || !address) return

    if (walletLoadState === 'loading') return

    const addressKey = address.toLowerCase()
    if (lastImportedAddress.current === addressKey) return

    if (walletResult.status === 'success' || walletResult.status === 'partial') {
      const incoming = convertWalletPositionsToEntries(
        walletResult.data.positions,
        reserves,
      )
      lastImportedAddress.current = addressKey

      if (incoming.length === 0) {
        portfolioActions.importReserves([])
        toast.info('Wallet has no positions')
        return
      }

      portfolioActions.importReserves(incoming)
      onImport?.()
      toast.success(`Imported ${incoming.length} position${incoming.length > 1 ? 's' : ''} from wallet`)
    } else if (walletResult.status === 'error') {
      lastImportedAddress.current = addressKey
      console.error('[wallet-import] All sources failed:', walletResult.error)
      toast.error('Failed to load wallet positions')
    }
  }, [isConnected, address, walletLoadState, walletResult, reserves, portfolioActions, onImport])

  useEffect(() => {
    if (!isConnected || !address) {
      const hadConnected = wasConnected.current
      wasConnected.current = false
      // Note: assumes isConnected=true always comes with a valid address.
      // If wallet library emits isConnected=true + address=undefined briefly,
      // this would incorrectly trigger onDisconnect before the real connect completes.
      const removed = portfolioActions.removeWalletEntries()
      if (removed > 0) {
        toast.info(`Removed ${removed} wallet position${removed > 1 ? 's' : ''}`)
      }
      lastImportedAddress.current = null
      lastDegradedShown.current = false
      if (hadConnected) onDisconnect?.()
      return
    }

    wasConnected.current = true

    if (lastDegradedShown.current) return

    const degraded: string[] = []
    if (v3SdkFailed) degraded.push('V3')
    if (v4SdkFailed) degraded.push('V4')

    if (degraded.length > 0 && walletLoadState !== 'loading' && walletLoadState !== 'idle') {
      lastDegradedShown.current = true
      toast.warning(`${degraded.join(' + ')} SDK unavailable — using on-chain fallback`, {
        duration: 5000,
      })
    }
  }, [isConnected, address, v3SdkFailed, v4SdkFailed, walletLoadState, portfolioActions, onDisconnect])
}
