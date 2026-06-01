import type { PortfolioPosition } from '@/types/portfolio'

interface MergeParams {
  current: PortfolioPosition[]
  incoming: PortfolioPosition[]
}

function positionKey(pos: PortfolioPosition): string {
  return `${pos.reserveId}::${pos.side}`
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
      result.set(key, {
        ...existing,
        amount: walletPos.amount,
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
