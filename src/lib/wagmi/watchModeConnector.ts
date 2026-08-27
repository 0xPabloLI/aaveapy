import { createConnector } from 'wagmi'

const STORAGE_KEY = 'wagmi.watchAddress'
const READ_ONLY_ERROR = 'Watch mode is read-only'

type WatchProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
  on: () => void
  removeListener: () => void
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`
}

export function watchModeConnector() {
  let watchAddress: `0x${string}` | undefined
  let emitWatchAddressChange: ((address: `0x${string}`) => void) | undefined

  function setWatchAddress(addr: `0x${string}`) {
    watchAddress = addr
    localStorage.setItem(STORAGE_KEY, addr)
    emitWatchAddressChange?.(addr)
  }

  const connector = createConnector((config) => {
    emitWatchAddressChange = (address) => {
      config.emitter.emit('change', { accounts: [address] })
    }

    return {
      id: 'watchMode' as const,
      name: 'View any address',
      type: 'watchMode' as const,
      setWatchAddress,

      async connect({ chainId }: { chainId?: number } = {}) {
        const address = watchAddress
          ?? (localStorage.getItem(STORAGE_KEY) as `0x${string}` | null)
          ?? undefined
        if (!address) throw new Error('No watch address set. Call setWatchAddress first.')
        const resolvedChainId = chainId ?? config.chains[0].id
        localStorage.setItem(STORAGE_KEY, address)
        return { accounts: [address], chainId: resolvedChainId }
      },

      async disconnect() {
        watchAddress = undefined
        localStorage.removeItem(STORAGE_KEY)
      },

      async getAccounts() {
        const address = watchAddress
          ?? (localStorage.getItem(STORAGE_KEY) as `0x${string}` | null)
          ?? undefined
        return address ? [address] : []
      },

      async getChainId() {
        return config.chains[0].id
      },

      async getProvider({ chainId }: { chainId?: number } = {}) {
        const resolvedChainId = chainId ?? config.chains[0].id
        const provider: WatchProvider = {
          async request({ method }) {
            const address = watchAddress
              ?? (localStorage.getItem(STORAGE_KEY) as `0x${string}` | null)
              ?? undefined

            if (method === 'eth_chainId') return toHexChainId(resolvedChainId)
            if (method === 'eth_accounts') return address ? [address] : []
            if (method === 'eth_requestAccounts') return address ? [address] : []
            if (method.startsWith('personal_') || method.startsWith('wallet_') || method.includes('sign')) {
              throw new Error(READ_ONLY_ERROR)
            }
            throw new Error(`Watch mode provider does not support ${method}`)
          },
          on() {},
          removeListener() {},
        }
        return provider
      },

      async isAuthorized() {
        const address = watchAddress
          ?? (localStorage.getItem(STORAGE_KEY) as `0x${string}` | null)
        return !!address
      },

      async switchChain({ chainId }) {
        const chain = config.chains.find((x) => x.id === chainId)
        if (!chain) throw new Error(`Chain ${chainId} not configured`)
        return chain
      },

      async signMessage() {
        throw new Error(READ_ONLY_ERROR)
      },

      async signTypedData() {
        throw new Error(READ_ONLY_ERROR)
      },

      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {
        config.emitter.emit('disconnect')
      },
    } as unknown as ReturnType<Parameters<typeof createConnector>[0]>
  })

  return Object.assign(connector, { setWatchAddress, type: 'watchMode' as const })
}

export { STORAGE_KEY, READ_ONLY_ERROR }
