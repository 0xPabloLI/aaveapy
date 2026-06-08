import type { PortfolioSideData, WalletSyncState } from '@/types/portfolio'
import { computeDelta } from './deltaCalculator'

export function getSideSyncState(side: PortfolioSideData): WalletSyncState {
  if (side.walletValue === null) return 'manual'
  if (side.inputMode !== 'usd') return 'modified'
  const { deltaUsd } = computeDelta({
    amount: side.amount,
    walletValue: side.walletValue,
    inputMode: side.inputMode,
  })
  if (deltaUsd === 0) return 'synced'
  return 'modified'
}
