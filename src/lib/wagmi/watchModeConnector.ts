import { createConnector } from 'wagmi'

const STORAGE_KEY = 'wagmi.watchAddress'
const READ_ONLY_ERROR = 'Watch mode is read-only'

export function watchModeConnector() {
  let watchAddress: `0x${string}` | undefined

  function setWatchAddress(addr: `0x${string}`) {
    watchAddress = addr
    localStorage.setItem(STORAGE_KEY, addr)
  }

  const connector = createConnector((config) => ({
    id: 'watchMode' as const,
    name: 'View any address',
    type: 'watchMode' as const,
    setWatchAddress,

    async connect({ chainId } = {}) {
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
  }))

  return Object.assign(connector, { setWatchAddress, type: 'watchMode' as const })
}

export { STORAGE_KEY, READ_ONLY_ERROR }
