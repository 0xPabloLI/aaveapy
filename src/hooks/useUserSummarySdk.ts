import { useUserSummary as useV4UserSummary } from '@aave/react'
import { useWallet } from './useWallet'

export interface UserSummaryData {
  lowestHealthFactor: number | null
  netAccruedInterest: number
  netApy: number
  netBalance: number
  totalCollateral: number
  totalDebt: number
  totalPositions: number
  totalSupplied: number
}


// The SDK returns branded `BigDecimal` values (string-like) and, depending on
// the version, either a plain `ExchangeAmount` or a `{ current }` wrapper.
// Normalize both shapes to a number here.
function toNumber(value: unknown): number {
  if (value == null) return 0
  const inner = (value as { current?: unknown }).current ?? value
  const raw = (inner as { value?: unknown }).value ?? inner
  const parsed = parseFloat(String(raw))
  return Number.isFinite(parsed) ? parsed : 0
}

export function useUserSummarySdk() {
  const { address, isConnected } = useWallet()
  const enabled = isConnected && !!address

  const account = (enabled ? address : undefined) as `0x${string}`
  const result = useV4UserSummary({ user: account, pause: !enabled } as never) as unknown as {
    loading: boolean
    error?: unknown
    data?: Record<string, unknown> & { totalPositions: number; lowestHealthFactor?: unknown }
  }

  if (result.loading || !result.data) {
    return { data: undefined, loading: result.loading, error: result.error }
  }

  const summary = result.data
  const data: UserSummaryData = {
    lowestHealthFactor: summary.lowestHealthFactor != null ? parseFloat(String(summary.lowestHealthFactor)) : null,
    netAccruedInterest: toNumber(summary.netAccruedInterest),
    netApy: toNumber(summary.netApy),
    netBalance: toNumber(summary.netBalance),
    totalCollateral: toNumber(summary.totalCollateral),
    totalDebt: toNumber(summary.totalDebt),
    totalPositions: summary.totalPositions,
    totalSupplied: toNumber(summary.totalSupplied),
  }

  return { data, loading: false as const, error: undefined }
}
