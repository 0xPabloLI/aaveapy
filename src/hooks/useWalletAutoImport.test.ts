// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

const mockConvert = vi.fn()
vi.mock('@/lib/walletPositionToPortfolio', () => ({
  convertWalletPositionsToPortfolio: (...args: unknown[]) => mockConvert(...args),
}))

import { toast } from 'sonner'
import { useWalletAutoImport } from '@/hooks/useWalletAutoImport'
import type { DegradedResult } from '@/hooks/useUserPositionsSdk'
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation'
import type { PortfolioPosition } from '@/types/portfolio'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

const mockImportPositions = vi.fn()
const mockPortfolioActions: PortfolioSimulationActions = {
  setActive: vi.fn(),
  addPosition: vi.fn(),
  removePosition: vi.fn(),
  updateAmount: vi.fn(),
  updateInputMode: vi.fn(),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  importPositions: mockImportPositions,
  restorePosition: vi.fn(),
  toggleHidden: vi.fn(),
}

function makeSuccessResult(positions: WalletPosition[] = []): DegradedResult {
  return {
    status: 'success',
    data: { positions, failedSources: [] },
  }
}

function makePartialResult(positions: WalletPosition[] = []): DegradedResult {
  return {
    status: 'partial',
    data: { positions, failedSources: ['sdk-v3'] },
    retry: vi.fn(),
  }
}

function makeErrorResult(): DegradedResult {
  return {
    status: 'error',
    error: new Error('fail'),
    retry: vi.fn(),
  }
}

const address = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`
const emptyReserves: ReserveWithSpread[] = []
const convertedPositions: PortfolioPosition[] = [
  { positionId: 'r1:supply', reserveId: 'r1' } as PortfolioPosition,
]

describe('useWalletAutoImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConvert.mockReturnValue(convertedPositions)
  })

  it('auto-imports positions on wallet connect', () => {
    const walletPositions = [{ reserveId: 'r1', side: 'supply' }]
    const { rerender } = renderHook(
      (props: { isConnected: boolean; walletResult: DegradedResult; walletLoadState: string }) =>
        useWalletAutoImport({
          address,
          isConnected: props.isConnected,
          walletLoadState: props.walletLoadState,
          walletResult: props.walletResult,
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
        }),
      {
        initialProps: {
          isConnected: false,
          walletResult: makeSuccessResult(),
          walletLoadState: 'idle' as const,
        },
      },
    )

    rerender({ isConnected: true, walletResult: makeSuccessResult(walletPositions), walletLoadState: 'success' })

    expect(mockConvert).toHaveBeenCalledWith(walletPositions, emptyReserves)
    expect(mockImportPositions).toHaveBeenCalledWith(convertedPositions)
    expect(toast.success).toHaveBeenCalled()
  })

  it('shows toast when wallet has no positions', () => {
    mockConvert.mockReturnValue([])

    renderHook(() =>
      useWalletAutoImport({
        address,
        isConnected: true,
        walletLoadState: 'success',
        walletResult: makeSuccessResult([]),
        v3SdkFailed: false,
        v4SdkFailed: false,
        reserves: emptyReserves,
        portfolioActions: mockPortfolioActions,
      }),
    )

    expect(mockImportPositions).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('Wallet has no positions')
  })

  it('shows error toast on wallet result error', () => {
    renderHook(() =>
      useWalletAutoImport({
        address,
        isConnected: true,
        walletLoadState: 'error',
        walletResult: makeErrorResult(),
        v3SdkFailed: false,
        v4SdkFailed: false,
        reserves: emptyReserves,
        portfolioActions: mockPortfolioActions,
      }),
    )

    expect(toast.error).toHaveBeenCalledWith('Failed to load wallet positions')
  })

  it('shows SDK degradation toast when SDK fails', () => {
    renderHook(() =>
      useWalletAutoImport({
        address,
        isConnected: true,
        walletLoadState: 'success',
        walletResult: makePartialResult(),
        v3SdkFailed: true,
        v4SdkFailed: false,
        reserves: emptyReserves,
        portfolioActions: mockPortfolioActions,
      }),
    )

    expect(toast.warning).toHaveBeenCalledWith(
      'V3 SDK unavailable — using on-chain fallback',
      { duration: 5000 },
    )
  })

  it('does not re-import for same address', () => {
    const walletPositions = [{ reserveId: 'r1', side: 'supply' }]

    const { rerender } = renderHook(
      (props: { walletResult: DegradedResult }) =>
        useWalletAutoImport({
          address,
          isConnected: true,
          walletLoadState: 'success',
          walletResult: props.walletResult,
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
        }),
      { initialProps: { walletResult: makeSuccessResult(walletPositions) } },
    )

    expect(mockImportPositions).toHaveBeenCalledTimes(1)

    rerender({ walletResult: makeSuccessResult(walletPositions) })

    expect(mockImportPositions).toHaveBeenCalledTimes(1)
  })

  it('resets state when wallet disconnects', () => {
    const walletPositions = [{ reserveId: 'r1', side: 'supply' }]

    const { rerender } = renderHook(
      (props: { isConnected: boolean }) =>
        useWalletAutoImport({
          address: props.isConnected ? address : undefined,
          isConnected: props.isConnected,
          walletLoadState: props.isConnected ? 'success' : 'idle',
          walletResult: props.isConnected ? makeSuccessResult(walletPositions) : makeErrorResult(),
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
        }),
      { initialProps: { isConnected: true } },
    )

    expect(mockImportPositions).toHaveBeenCalledTimes(1)

    rerender({ isConnected: false })
    rerender({ isConnected: true })

    expect(mockImportPositions).toHaveBeenCalledTimes(2)
  })
})
