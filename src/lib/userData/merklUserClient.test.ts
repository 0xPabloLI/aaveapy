import { describe, expect, it } from 'vitest'
import { toClaimableList, MerklUserRewardsResponseSchema } from './merklUserClient'
import type { MerklUserRewardsResponse } from './merklUserClient'

const VALID_RESPONSE: MerklUserRewardsResponse = {
  rewards: [
    {
      chainId: 1,
      rewards: [
        {
          token: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, chainId: 1 },
          amount: '1000000',
          pending: '50000',
          claimed: '300000',
          proofs: ['0xproof1', '0xproof2'],
          breakdowns: [
            { campaignId: 'camp-1', amount: '700000', reason: 'supply incentive' },
            { campaignId: 'camp-2', amount: '300000', reason: 'borrow incentive' },
          ],
        },
      ],
    },
    {
      chainId: 42161,
      rewards: [
        {
          token: { address: '0xDA10009cBd1D6b9B9D78A6cB0e6e3C2b6E1b3E5', symbol: 'DAI', decimals: 18, chainId: 42161 },
          amount: '2000000000000000000',
          pending: '0',
          claimed: '500000000000000000',
          proofs: [],
          breakdowns: [{ campaignId: 'camp-3', amount: '2000000000000000000', reason: 'supply' }],
        },
      ],
    },
  ],
}

describe('MerklUserRewardsResponseSchema', () => {
  it('parses a valid response', () => {
    const result = MerklUserRewardsResponseSchema.safeParse(VALID_RESPONSE)
    expect(result.success).toBe(true)
  })

  it('rejects response with missing rewards', () => {
    const result = MerklUserRewardsResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('toClaimableList', () => {
  it('converts multi-chain rewards to claimable list', () => {
    const claimables = toClaimableList(VALID_RESPONSE)
    expect(claimables).toHaveLength(2)
  })

  it('computes claimable = amount - claimed', () => {
    const claimables = toClaimableList(VALID_RESPONSE)
    const usdc = claimables.find((c) => c.tokenSymbol === 'USDC')!
    expect(usdc.claimable).toBe('700000')
  })

  it('preserves proofs and breakdowns', () => {
    const claimables = toClaimableList(VALID_RESPONSE)
    const usdc = claimables.find((c) => c.tokenSymbol === 'USDC')!
    expect(usdc.proofs).toEqual(['0xproof1', '0xproof2'])
    expect(usdc.breakdowns).toHaveLength(2)
    expect(usdc.breakdowns[0].campaignId).toBe('camp-1')
  })

  it('handles empty rewards', () => {
    const claimables = toClaimableList({ rewards: [] })
    expect(claimables).toEqual([])
  })

  it('carries token metadata', () => {
    const claimables = toClaimableList(VALID_RESPONSE)
    const dai = claimables.find((c) => c.tokenSymbol === 'DAI')!
    expect(dai.chainId).toBe(42161)
    expect(dai.tokenDecimals).toBe(18)
    expect(dai.tokenAddress).toBe('0xDA10009cBd1D6b9B9D78A6cB0e6e3C2b6E1b3E5')
  })
})
