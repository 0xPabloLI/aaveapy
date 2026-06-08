import type { PortfolioReserveEntry } from '@/types/portfolio'

export function sortEntriesByHidden(entries: PortfolioReserveEntry[]): PortfolioReserveEntry[] {
  const visible = entries.filter(e => !e.hidden)
  const hidden = entries.filter(e => e.hidden)
  return [...visible, ...hidden]
}

export function getEntrySoftDeleteAction(entry: PortfolioReserveEntry): 'toggleHidden' | 'remove' {
  const anyWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null
  return anyWallet ? 'toggleHidden' : 'remove'
}
