import type { PortfolioReserveEntry } from '@/types/portfolio'

function hasWalletPosition(entry: PortfolioReserveEntry): boolean {
  return entry.supply.walletValue !== null || entry.borrow.walletValue !== null
}

export function sortEntriesByHidden(entries: PortfolioReserveEntry[]): PortfolioReserveEntry[] {
  const walletVisible = entries.filter(e => !e.hidden && hasWalletPosition(e))
  const manualVisible = entries.filter(e => !e.hidden && !hasWalletPosition(e))
  const hidden = entries.filter(e => e.hidden)
  return [...walletVisible, ...manualVisible, ...hidden]
}
