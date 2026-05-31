import { useAccount, useDisconnect, useConnect } from 'wagmi'

export function useWallet() {
  const { address, chainId, isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect } = useConnect()

  const isWatchMode = connector?.id === 'watchMode'

  return {
    address,
    chainId,
    isConnected,
    isWatchMode,
    connect,
    disconnect,
  }
}
