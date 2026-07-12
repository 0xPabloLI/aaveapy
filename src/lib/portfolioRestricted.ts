import type { PortfolioReserveEntry } from '@/types/portfolio'

export function canUnhide(entry: PortfolioReserveEntry): boolean {
  return entry.restrictedStatus == null
}

export function applyRestrictedHidden(
  entries: PortfolioReserveEntry[],
): PortfolioReserveEntry[] {
  return entries.map((entry) =>
    entry.restrictedStatus != null && !entry.hidden
      ? { ...entry, hidden: true }
      : entry,
  )
}
