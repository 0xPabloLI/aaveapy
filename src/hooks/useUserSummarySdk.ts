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


export function useUserSummarySdk() {
  const { address, isConnected } = useWallet()
  const enabled = isConnected && !!address

  const account = (enabled ? address : undefined) as `0x${string}`
  const result = useV4UserSummary({ account }, { enabled })

  if (result.loading || !result.data) {
    return { data: undefined, loading: result.loading, error: result.error }
  }

  const summary = result.data
  const data: UserSummaryData = {
    lowestHealthFactor: summary.lowestHealthFactor != null ? parseFloat(String(summary.lowestHealthFactor)) : null,
    netAccruedInterest: parseFloat(summary.netAccruedInterest.value),
    netApy: parseFloat(summary.netApy.value),
    netBalance: parseFloat(summary.netBalance.current.value),
    totalCollateral: parseFloat(summary.totalCollateral.current.value),
    totalDebt: parseFloat(summary.totalDebt.current.value),
    totalPositions: summary.totalPositions,
    totalSupplied: parseFloat(summary.totalSupplied.current.value),
  }

  return { data, loading: false as const, error: undefined }
}
