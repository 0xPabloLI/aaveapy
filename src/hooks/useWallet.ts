import { useCallback } from 'react'
import { useAccount, useDisconnect, useConnect, useConnections, useConfig } from 'wagmi'
import { disconnect } from '@wagmi/core'

export function useWallet() {
  const { address, chainId, isConnected, connector } = useAccount()
  const { disconnect: disconnectCurrent, disconnectAsync: disconnectCurrentAsync } = useDisconnect()
  const { connect } = useConnect()
  const connections = useConnections()
  const config = useConfig()

  const isWatchMode = connector?.id === 'watchMode'

  const disconnectAllAsync = useCallback(async () => {
    for (const connection of connections) {
      await disconnect(config, { connector: connection.connector })
    }
  }, [connections, config])

  return {
    address,
    chainId,
    isConnected,
    isWatchMode,
    connect,
    disconnect: disconnectCurrent,
    disconnectAsync: disconnectCurrentAsync,
    disconnectAllAsync,
  }
}
