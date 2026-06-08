import type { PortfolioPosition } from '@/types/portfolio'
import { getWalletSyncState } from './portfolioWalletSync'
import { formatConvertedAmount } from './portfolioCalculator'

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

/** @deprecated Logic inlined in usePortfolioSimulation.hideOrRemoveReserveAction. */
export function hideOrRemoveReserve(
  reserveId: string,
  positions: PortfolioPosition[],
): PortfolioPosition[] {
  const group = positions.filter(p => p.reserveId === reserveId)
  if (group.length === 0) return positions
  const anyWallet = group.some(p => p.walletValue !== null)
  if (anyWallet) {
    return positions.flatMap(p => {
      if (p.reserveId !== reserveId) return [p]
      if (p.walletValue === null) return []
      return [{
        ...p,
        amount: formatConvertedAmount(p.walletValue),
        inputMode: 'usd' as const,
        hidden: true,
      }]
    })
  }
  return positions.filter(p => p.reserveId !== reserveId)
}

/** @deprecated Logic inlined in usePortfolioSimulation.unhideReserve. */
export function unhideReserve(
  reserveId: string,
  positions: PortfolioPosition[],
): PortfolioPosition[] {
  return positions.map(p =>
    p.reserveId === reserveId ? { ...p, hidden: false } : p
  )
}
