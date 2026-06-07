import type { PortfolioPosition } from '@/types/portfolio'
import { formatConvertedAmount } from './portfolioCalculator'

interface MergeParams {
  current: PortfolioPosition[]
  incoming: PortfolioPosition[]
}

function positionKey(pos: PortfolioPosition): string {
  return `${pos.reserveId}::${pos.side}`
}

/**
 * True when the existing position's amount differs from what its previous
 * walletValue would have produced — i.e. the user manually edited it.
 */
function isManuallyEdited(existing: PortfolioPosition): boolean {
  if (existing.walletValue === null) {
    // Purely manual row (no wallet backing) — any non-empty amount is manual.
    return existing.amount.trim() !== ''
  }
  if (existing.inputMode !== 'usd') return true
  const expected = formatConvertedAmount(existing.walletValue)
  return existing.amount.trim() !== expected
}

export function mergePositions({ current, incoming }: MergeParams): PortfolioPosition[] {
  const currentMap = new Map<string, PortfolioPosition>()
  for (const pos of current) {
    currentMap.set(positionKey(pos), pos)
  }

  const result = new Map<string, PortfolioPosition>()

  for (const walletPos of incoming) {
    const key = positionKey(walletPos)
    const existing = currentMap.get(key)
    if (existing) {
      const manual = isManuallyEdited(existing)
      result.set(key, {
        ...existing,
        // Preserve manual edits; only refresh wallet-tracking rows.
        amount: manual ? existing.amount : walletPos.amount,
        inputMode: manual ? existing.inputMode : walletPos.inputMode,
        walletValue: walletPos.walletValue,
        hidden: false,
        isOrphan: walletPos.isOrphan,
      })
    } else {
      result.set(key, { ...walletPos })
    }
    currentMap.delete(key)
  }

  for (const [, pos] of currentMap) {
    if (pos.walletValue === null) {
      result.set(positionKey(pos), pos)
    }
  }

  return Array.from(result.values())
}
