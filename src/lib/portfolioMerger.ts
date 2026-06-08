/** @deprecated Use mergeEntriesWithDelta in usePortfolioSimulation instead. */
import type { PortfolioPosition } from '@/types/portfolio'
import { formatConvertedAmount } from './portfolioCalculator'
import { computeDelta } from './deltaCalculator'

interface MergeParams {
  current: PortfolioPosition[]
  incoming: PortfolioPosition[]
}

function positionKey(pos: PortfolioPosition): string {
  return `${pos.reserveId}::${pos.side}`
}

function hasNonZeroDelta(existing: PortfolioPosition): boolean {
  if (existing.walletValue === null) {
    return existing.amount.trim() !== ''
  }
  if (existing.inputMode !== 'usd') return true
  const { deltaUsd } = computeDelta({
    amount: existing.amount,
    walletValue: existing.walletValue,
    inputMode: existing.inputMode,
  })
  return deltaUsd !== 0
}

function computeNewAmount(existing: PortfolioPosition, newWalletValue: number): string {
  const { deltaUsd } = computeDelta({
    amount: existing.amount,
    walletValue: existing.walletValue,
    inputMode: existing.inputMode,
  })
  const newEffective = Math.max(newWalletValue + deltaUsd, 0)
  return formatConvertedAmount(newEffective)
}

/** @deprecated Use mergeEntriesWithDelta instead. */
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
      const edited = hasNonZeroDelta(existing)
      const newAmount = edited && walletPos.walletValue !== null
        ? computeNewAmount(existing, walletPos.walletValue)
        : edited ? existing.amount : walletPos.amount
      result.set(key, {
        ...existing,
        amount: newAmount,
        inputMode: edited ? existing.inputMode : walletPos.inputMode,
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
