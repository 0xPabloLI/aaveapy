import type { PortfolioPosition, WalletSyncState } from '@/types/portfolio'
import { computeDelta } from './deltaCalculator'

export function getWalletSyncState(pos: PortfolioPosition): WalletSyncState {
  if (pos.walletValue === null) return 'manual'
  if (pos.inputMode !== 'usd') return 'modified'
  const { deltaUsd } = computeDelta({
    amount: pos.amount,
    walletValue: pos.walletValue,
    inputMode: pos.inputMode,
  })
  if (deltaUsd === 0) return 'synced'
  return 'modified'
}
