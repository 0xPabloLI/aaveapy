import { describe, expect, it, beforeEach } from 'vitest'
import { watchModeConnector, STORAGE_KEY, READ_ONLY_ERROR } from './watchModeConnector'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage })

function createTestConfig() {
  const connectorFn = watchModeConnector()
  const config = createConfig({
    chains: [mainnet],
    connectors: [connectorFn],
    transports: { [mainnet.id]: http() },
  })
  const connector = config.connectors[0]
  return { config, connector, connectorFn }
}

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as `0x${string}`

describe('watchModeConnector', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  describe('connector metadata', () => {
    it('has id "watchMode" and name "View any address"', () => {
      const { connector } = createTestConfig()
      expect(connector.id).toBe('watchMode')
      expect(connector.name).toBe('View any address')
    })

    it('type is "watchMode"', () => {
      const { connectorFn } = createTestConfig()
      expect(connectorFn.type).toBe('watchMode')
    })
  })

  describe('setWatchAddress', () => {
    it('exposes setWatchAddress on the factory function', () => {
      const { connectorFn } = createTestConfig()
      expect(typeof connectorFn.setWatchAddress).toBe('function')
    })

    it('persists address to localStorage', () => {
      const { connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      expect(localStorage.getItem(STORAGE_KEY)).toBe(TEST_ADDRESS)
    })
  })

  describe('connect', () => {
    it('returns the watch address after setWatchAddress', async () => {
      const { connector, connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      const result = await connector.connect({ chainId: mainnet.id })
      expect(result.accounts).toEqual([TEST_ADDRESS])
      expect(result.chainId).toBe(mainnet.id)
    })

    it('throws if no watch address set', async () => {
      const { connector } = createTestConfig()
      await expect(connector.connect()).rejects.toThrow('No watch address set')
    })

    it('restores address from localStorage on connect', async () => {
      localStorage.setItem(STORAGE_KEY, TEST_ADDRESS)
      const { connector } = createTestConfig()
      const result = await connector.connect({ chainId: mainnet.id })
      expect(result.accounts).toEqual([TEST_ADDRESS])
    })
  })

  describe('disconnect', () => {
    it('clears localStorage on disconnect', async () => {
      const { connector, connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      await connector.connect({ chainId: mainnet.id })
      await connector.disconnect()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('isAuthorized', () => {
    it('returns true when localStorage has address', async () => {
      localStorage.setItem(STORAGE_KEY, TEST_ADDRESS)
      const { connector } = createTestConfig()
      const authorized = await connector.isAuthorized()
      expect(authorized).toBe(true)
    })

    it('returns false when no address', async () => {
      const { connector } = createTestConfig()
      const authorized = await connector.isAuthorized()
      expect(authorized).toBe(false)
    })
  })

  describe('getProvider', () => {
    it('exposes a read-only EIP-1193 provider for RainbowKit compatibility', async () => {
      const { connector, connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      const provider = await connector.getProvider() as { request: (args: { method: string }) => Promise<unknown> }

      await expect(provider.request({ method: 'eth_accounts' })).resolves.toEqual([TEST_ADDRESS])
      await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe('0x1')
      await expect(provider.request({ method: 'personal_sign' })).rejects.toThrow(READ_ONLY_ERROR)
    })
  })

  describe('read-only enforcement', () => {
    it('signMessage throws read-only error', async () => {
      const { connector, connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      await connector.connect({ chainId: mainnet.id })
      await expect(
        (connector.signMessage as (a: { message: string }) => Promise<unknown>)({ message: 'test' })
      ).rejects.toThrow(READ_ONLY_ERROR)
    })

    it('signTypedData throws read-only error', async () => {
      const { connector, connectorFn } = createTestConfig()
      connectorFn.setWatchAddress(TEST_ADDRESS)
      await connector.connect({ chainId: mainnet.id })
      await expect(
        (connector.signTypedData as (a: Record<string, unknown>) => Promise<unknown>)({
          domain: {},
          types: { EIP712Domain: [] },
          primaryType: 'Test',
          message: {},
        })
      ).rejects.toThrow(READ_ONLY_ERROR)
    })
  })
})
