import type { PortfolioPosition, WalletSyncState } from '@/types/portfolio'

export function getWalletSyncState(pos: PortfolioPosition): WalletSyncState {
  if (pos.walletValue === null) return 'manual'
  const currentUsd = parseFloat(pos.amount) || 0
  if (currentUsd === pos.walletValue) return 'synced'
  return 'modified'
}
