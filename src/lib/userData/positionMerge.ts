import type { WalletPosition } from './userPositionMapper'

export function mergeAndDedupPositions(
  sdkPositions: readonly WalletPosition[],
  fallbackPositions: readonly WalletPosition[],
  gapPositions: readonly WalletPosition[],
): WalletPosition[] {
  const seen = new Set<string>()
  const result: WalletPosition[] = []

  for (const pos of sdkPositions) {
    const key = dedupKey(pos)
    if (!key) continue
    if (!seen.has(key)) {
      seen.add(key)
      result.push(pos)
    }
  }

  for (const pos of fallbackPositions) {
    const key = dedupKey(pos)
    if (!key) continue
    if (!seen.has(key)) {
      seen.add(key)
      result.push(pos)
    }
  }

  for (const pos of gapPositions) {
    const key = dedupKey(pos)
    if (!key) continue
    if (!seen.has(key)) {
      seen.add(key)
      result.push(pos)
    }
  }

  return result
}

function dedupKey(pos: WalletPosition): string | null {
  if (!pos.reserveId) return null
  return `${pos.reserveId}::${pos.side}`
}

export function mergeFailedSources(
  sdkFailed: readonly string[],
  fallbackFailed: readonly string[],
  gapFailed: readonly string[],
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const src of [...sdkFailed, ...fallbackFailed, ...gapFailed]) {
    if (!seen.has(src)) {
      seen.add(src)
      result.push(src)
    }
  }
  return result
}
