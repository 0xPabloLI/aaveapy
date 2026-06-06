import type { PortfolioPosition } from '@/types/portfolio'
import { getWalletSyncState } from './portfolioWalletSync'

export function sortPositionsByHidden(positions: PortfolioPosition[]): PortfolioPosition[] {
  const visible = positions.filter(p => !p.hidden)
  const hidden = positions.filter(p => p.hidden)
  return [...visible, ...hidden]
}

export function getSoftDeleteAction(pos: PortfolioPosition): 'toggleHidden' | 'remove' {
  const state = getWalletSyncState(pos)
  return state === 'manual' ? 'remove' : 'toggleHidden'
}

/**
 * For a group of positions belonging to the same reserve (e.g. supply + borrow),
 * decide whether removing the row should soft-hide (any side has wallet origin)
 * or hard-remove (all sides are purely manual).
 */
export function getGroupSoftDeleteAction(
  positions: Array<PortfolioPosition | null | undefined>,
): 'toggleHidden' | 'remove' {
  const anyWallet = positions.some(p => p && p.walletValue !== null)
  return anyWallet ? 'toggleHidden' : 'remove'
}
