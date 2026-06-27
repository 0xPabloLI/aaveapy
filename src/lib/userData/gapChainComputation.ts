import { getProtocolVersion } from '../protocolVersion'

export interface SdkCoverage {
  v3SdkChainIds: readonly number[]
  v4SdkChainIds: readonly number[]
}

export interface ReserveChainEntry {
  chainId: number
  marketName: string
}

export interface GapChainIds {
  v3Gap: number[]
  v4Gap: number[]
}

export function computeGapChainIds(
  reserves: readonly ReserveChainEntry[],
  sdkCoverage: SdkCoverage,
): GapChainIds {
  if (sdkCoverage.v3SdkChainIds.length === 0 && sdkCoverage.v4SdkChainIds.length === 0) {
    return { v3Gap: [], v4Gap: [] }
  }

  const v3SdkSet = new Set(sdkCoverage.v3SdkChainIds)
  const v4SdkSet = new Set(sdkCoverage.v4SdkChainIds)

  const v3Gap: number[] = []
  const v4Gap: number[] = []
  const seen = new Set<number>()

  for (const { chainId, marketName } of reserves) {
    if (seen.has(chainId)) continue
    if (v3SdkSet.has(chainId) || v4SdkSet.has(chainId)) continue
    seen.add(chainId)

    if (getProtocolVersion(marketName) === 'v4') {
      v4Gap.push(chainId)
    } else {
      v3Gap.push(chainId)
    }
  }

  return { v3Gap, v4Gap }
}
