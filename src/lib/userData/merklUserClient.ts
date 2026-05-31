import { z } from 'zod'

const MerklTokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  chainId: z.number(),
})

const MerklRewardBreakdownSchema = z.object({
  campaignId: z.string(),
  amount: z.string(),
  reason: z.string(),
})

const MerklRewardSchema = z.object({
  token: MerklTokenSchema,
  amount: z.string(),
  pending: z.string(),
  claimed: z.string(),
  proofs: z.array(z.string()),
  breakdowns: z.array(MerklRewardBreakdownSchema),
})

const MerklChainRewardsSchema = z.object({
  chainId: z.number(),
  rewards: z.array(MerklRewardSchema),
})

export const MerklUserRewardsResponseSchema = z.object({
  rewards: z.array(MerklChainRewardsSchema),
})

export type MerklUserRewardsResponse = z.infer<typeof MerklUserRewardsResponseSchema>

export interface MerklClaimable {
  chainId: number
  tokenSymbol: string
  tokenAddress: string
  tokenDecimals: number
  amount: string
  pending: string
  claimed: string
  claimable: string
  proofs: string[]
  breakdowns: Array<{ campaignId: string; amount: string; reason: string }>
}

const MERKL_API_BASE = 'https://api.merkl.xyz'

export async function fetchUserMerklRewards(
  address: `0x${string}`,
  chainIds: number[],
): Promise<MerklUserRewardsResponse> {
  const chainIdParam = chainIds.join(',')
  const url = `${MERKL_API_BASE}/v4/users/${address}/rewards?chainId=${chainIdParam}`

  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) {
    throw new Error(`Merkl API error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return MerklUserRewardsResponseSchema.parse(json)
}

export function toClaimableList(response: MerklUserRewardsResponse): MerklClaimable[] {
  const result: MerklClaimable[] = []

  for (const chainRewards of response.rewards) {
    for (const reward of chainRewards.rewards) {
      const amount = BigInt(reward.amount)
      const claimed = BigInt(reward.claimed)
      const claimable = (amount - claimed).toString()

      result.push({
        chainId: chainRewards.chainId,
        tokenSymbol: reward.token.symbol,
        tokenAddress: reward.token.address,
        tokenDecimals: reward.token.decimals,
        amount: reward.amount,
        pending: reward.pending,
        claimed: reward.claimed,
        claimable,
        proofs: reward.proofs,
        breakdowns: reward.breakdowns,
      })
    }
  }

  return result
}
