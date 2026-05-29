import { describe, expect, it } from 'vitest'
import { wagmiConfig, WALLET_SUPPORTED_CHAINS } from './config'
import { AAVE_CHAIN_IDS } from '../publicRpcUrls'

describe('wagmi/config', () => {
  describe('WALLET_SUPPORTED_CHAINS', () => {
    it('covers all Aave mainnet chain IDs', () => {
      const chainIds = WALLET_SUPPORTED_CHAINS.map((c) => c.id)
      for (const aaveId of AAVE_CHAIN_IDS) {
        expect(chainIds, `missing chain ${aaveId}`).toContain(aaveId)
      }
    })

    it('every chain has at least one RPC URL', () => {
      for (const chain of WALLET_SUPPORTED_CHAINS) {
        expect(
          chain.rpcUrls.default.http.length,
          `chain ${chain.id} has no RPC URLs`,
        ).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('wagmiConfig', () => {
    it('has chains matching WALLET_SUPPORTED_CHAINS', () => {
      const configChainIds = wagmiConfig.chains.map((c) => c.id)
      const supportedIds = WALLET_SUPPORTED_CHAINS.map((c) => c.id)
      expect(configChainIds.sort()).toEqual(supportedIds.sort())
    })

    it('has at least one connector', () => {
      expect(wagmiConfig.connectors.length).toBeGreaterThanOrEqual(1)
    })
  })
})
