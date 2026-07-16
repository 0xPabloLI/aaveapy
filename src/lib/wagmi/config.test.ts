import { describe, expect, it } from 'vitest'
import { wagmiConfig } from './config'
import { mainnet } from 'wagmi/chains'

describe('wagmi/config', () => {
  describe('wagmiConfig', () => {
    it('uses mainnet as the only chain', () => {
      const configChainIds = wagmiConfig.chains.map((c) => c.id)
      expect(configChainIds).toEqual([mainnet.id])
    })

    it('has at least one connector', () => {
      expect(wagmiConfig.connectors.length).toBeGreaterThanOrEqual(1)
    })

    it('includes watchMode connector', () => {
      const ids = wagmiConfig.connectors.map((c) => c.id)
      expect(ids).toContain('watchMode')
    })
  })
})
