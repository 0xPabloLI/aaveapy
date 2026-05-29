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
