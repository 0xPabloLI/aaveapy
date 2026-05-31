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

  const result = useV4UserSummary({ account: address! }, { enabled })

  if (result.loading || !result.data) {
    return { data: undefined, loading: result.loading, error: result.error }
  }

  const summary = result.data
  const data: UserSummaryData = {
    lowestHealthFactor: summary.lowestHealthFactor ? Number(summary.lowestHealthFactor) : null,
    netAccruedInterest: Number(summary.netAccruedInterest.value),
    netApy: Number(summary.netApy.value),
    netBalance: Number(summary.netBalance.current.value),
    totalCollateral: Number(summary.totalCollateral.current.value),
    totalDebt: Number(summary.totalDebt.current.value),
    totalPositions: summary.totalPositions,
    totalSupplied: Number(summary.totalSupplied.current.value),
  }

  return { data, loading: false as const, error: undefined }
}

export function useUserClaimableRewardsSdk() {
  const { address, isConnected } = useWallet()
  const enabled = isConnected && !!address

  const result = useV4UserClaimableRewards({ account: address! }, { enabled })

  if (result.loading || !result.data) {
    return { data: undefined, loading: result.loading, error: result.error }
  }

  const data: ClaimableRewardData[] = result.data.map((reward): ClaimableRewardData => {
    const merkl = reward as MerklReward
    return {
      id: String(merkl.id),
      claimable: Number(merkl.claimable?.amount?.value ?? 0),
      symbol: merkl.claimable?.exchange?.symbol ?? '',
      startDate: String(merkl.startDate ?? ''),
      endDate: String(merkl.endDate ?? ''),
      claimUntil: String(merkl.claimUntil ?? ''),
    }
  })

  return { data, loading: false as const, error: undefined }
}
