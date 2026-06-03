import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { WalletLoadState, DegradedResult } from '@/hooks/useUserPositionsSdk'
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation'
import type { ReserveWithSpread } from '@/types/aave'
import { convertWalletPositionsToPortfolio } from '@/lib/walletPositionToPortfolio'

interface UseWalletAutoImportParams {
  address: `0x${string}` | undefined
  isConnected: boolean
  walletLoadState: WalletLoadState
  walletResult: DegradedResult
  v3SdkFailed: boolean
  v4SdkFailed: boolean
  reserves: ReserveWithSpread[]
  portfolioActions: PortfolioSimulationActions
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
}: UseWalletAutoImportParams) {
  const lastImportedAddress = useRef<string | null>(null)
  const lastDegradedShown = useRef(false)

  useEffect(() => {
    if (!isConnected || !address) return

    if (walletLoadState === 'loading') return

    const addressKey = address.toLowerCase()
    if (lastImportedAddress.current === addressKey) return

    if (walletResult.status === 'success' || walletResult.status === 'partial') {
      const incoming = convertWalletPositionsToPortfolio(
        walletResult.data.positions,
        reserves,
      )
      lastImportedAddress.current = addressKey

      if (incoming.length === 0) {
        portfolioActions.importPositions([])
        toast.info('Wallet has no positions')
        return
      }

      portfolioActions.importPositions(incoming)
      toast.success(`Imported ${incoming.length} position${incoming.length > 1 ? 's' : ''} from wallet`)
    } else if (walletResult.status === 'error') {
      lastImportedAddress.current = addressKey
      console.error('[wallet-import] All sources failed:', walletResult.error)
      toast.error('Failed to load wallet positions')
    }
  }, [isConnected, address, walletLoadState, walletResult, reserves, portfolioActions])

  useEffect(() => {
    if (!isConnected || !address) {
      lastImportedAddress.current = null
      lastDegradedShown.current = false
      return
    }

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
  }, [isConnected, address, v3SdkFailed, v4SdkFailed, walletLoadState])
}
