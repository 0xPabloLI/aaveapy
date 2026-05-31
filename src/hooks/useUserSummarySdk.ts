import { useUserSummary as useV4UserSummary, useUserClaimableRewards as useV4UserClaimableRewards } from '@aave/react'
import type { UserClaimableReward } from '@aave/graphql'
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

export interface ClaimableRewardData {
  id: string
  claimable: number
  symbol: string
  startDate: string
  endDate: string
  claimUntil: string
}

type MerklReward = Extract<UserClaimableReward, { __typename: 'UserMerklClaimableReward' }>

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

export function useUserClaimableRewardsSdk() {
  const { address, isConnected } = useWallet()
  const enabled = isConnected && !!address

  const account = (enabled ? address : undefined) as `0x${string}`
  const result = useV4UserClaimableRewards({ account }, { enabled })

  if (result.loading || !result.data) {
    return { data: undefined, loading: result.loading, error: result.error }
  }

  const data: ClaimableRewardData[] = result.data
    .filter((reward): reward is MerklReward => reward.__typename === 'UserMerklClaimableReward')
    .map((merkl): ClaimableRewardData => ({
      id: String(merkl.id),
      claimable: parseFloat(merkl.claimable?.amount?.value ?? '0'),
      symbol: merkl.claimable?.exchange?.symbol ?? '',
      startDate: String(merkl.startDate ?? ''),
      endDate: String(merkl.endDate ?? ''),
      claimUntil: String(merkl.claimUntil ?? ''),
    }))

  return { data, loading: false as const, error: undefined }
}
