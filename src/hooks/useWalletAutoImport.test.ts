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
  convertWalletPositionsToEntries: (...args: unknown[]) => mockConvert(...args),
}))

import { toast } from 'sonner'
import { useWalletAutoImport } from '@/hooks/useWalletAutoImport'
import type { DegradedResult, WalletLoadState } from '@/hooks/useUserPositionsSdk'
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation'
import type { PortfolioReserveEntry } from '@/types/portfolio'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'

const mockImportReserves = vi.fn()
const mockRemoveWalletEntries = vi.fn(() => 0)
const mockPortfolioActions: PortfolioSimulationActions = {
  setActive: vi.fn(),
  addReserve: vi.fn(),
  updateReserve: vi.fn(),
  hideReserve: vi.fn(),
  unhideReserve: vi.fn(),
  removeReserve: vi.fn(),
  importReserves: mockImportReserves,
  forceSyncReserves: vi.fn(),
  restoreToWallet: vi.fn(),
  removeWalletEntries: mockRemoveWalletEntries,
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
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
const convertedEntries: PortfolioReserveEntry[] = [
  { reserveId: 'r1', marketName: '', chainName: '', chainId: -1, tokenSymbol: 'USDC', supply: { amount: '100', inputMode: 'usd', walletValue: 100 }, borrow: { amount: '', inputMode: 'usd', walletValue: null }, hidden: false, isOrphan: false, restrictedStatus: null },
]

describe('useWalletAutoImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConvert.mockReturnValue(convertedEntries)
  })

  it('auto-imports entries on wallet connect', () => {
    const walletPositions: WalletPosition[] = [{ reserveId: 'r1', side: 'supply', chainId: 1, asset: '0x1234567890123456789012345678901234567890' as `0x${string}`, tokenSymbol: 'USDC', amountWad: 0n, amountUsd: 100, isCollateral: false, source: 'sdk', isOrphan: false }]
    const { rerender } = renderHook(
      (props: { isConnected: boolean; walletResult: DegradedResult; walletLoadState: WalletLoadState }) =>
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
    expect(mockImportReserves).toHaveBeenCalledWith(convertedEntries)
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

    expect(mockImportReserves).toHaveBeenCalledWith([])
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
    const walletPositions = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]

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

    expect(mockImportReserves).toHaveBeenCalledTimes(1)

    rerender({ walletResult: makeSuccessResult(walletPositions) })

    expect(mockImportReserves).toHaveBeenCalledTimes(1)
  })

  it('resets state when wallet disconnects', () => {
    const walletPositions = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]

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

    expect(mockImportReserves).toHaveBeenCalledTimes(1)

    rerender({ isConnected: false })
    rerender({ isConnected: true })

    expect(mockImportReserves).toHaveBeenCalledTimes(2)
  })

  it('re-imports when wallet switches to a different address', () => {
    const addressA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`
    const addressB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`
    const positionsA = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]
    const positionsB = [{ reserveId: 'r2', side: 'borrow' }] as unknown as WalletPosition[]

    const { rerender } = renderHook(
      (props: { address: `0x${string}`; positions: WalletPosition[] }) =>
        useWalletAutoImport({
          address: props.address,
          isConnected: true,
          walletLoadState: 'success',
          walletResult: makeSuccessResult(props.positions),
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
        }),
      { initialProps: { address: addressA, positions: positionsA } },
    )

    expect(mockImportReserves).toHaveBeenCalledTimes(1)

    rerender({ address: addressB, positions: positionsB })

    expect(mockImportReserves).toHaveBeenCalledTimes(2)
    expect(mockConvert).toHaveBeenLastCalledWith(positionsB, emptyReserves)
  })

  it('does not re-import when same address with different checksum casing', () => {
    const addressLower = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`
    const addressUpper = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as `0x${string}`
    const positions = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]

    const { rerender } = renderHook(
      (props: { address: `0x${string}` }) =>
        useWalletAutoImport({
          address: props.address,
          isConnected: true,
          walletLoadState: 'success',
          walletResult: makeSuccessResult(positions),
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
        }),
      { initialProps: { address: addressLower } },
    )

    expect(mockImportReserves).toHaveBeenCalledTimes(1)

    rerender({ address: addressUpper })

    expect(mockImportReserves).toHaveBeenCalledTimes(1)
  })

  describe('disconnect cleanup', () => {
    it('calls removeWalletEntries when wallet disconnects', () => {
      const { rerender } = renderHook(
        (props: { isConnected: boolean }) =>
          useWalletAutoImport({
            address: props.isConnected ? address : undefined,
            isConnected: props.isConnected,
            walletLoadState: props.isConnected ? 'success' : 'idle',
            walletResult: props.isConnected ? makeSuccessResult() : makeErrorResult(),
            v3SdkFailed: false,
            v4SdkFailed: false,
            reserves: emptyReserves,
            portfolioActions: mockPortfolioActions,
          }),
        { initialProps: { isConnected: true } },
      )

      mockRemoveWalletEntries.mockClear()

      rerender({ isConnected: false })

      expect(mockRemoveWalletEntries).toHaveBeenCalledTimes(1)
    })

    it('shows toast when wallet entries are removed', () => {
      mockRemoveWalletEntries.mockReturnValue(2)

      const { rerender } = renderHook(
        (props: { isConnected: boolean }) =>
          useWalletAutoImport({
            address: props.isConnected ? address : undefined,
            isConnected: props.isConnected,
            walletLoadState: props.isConnected ? 'success' : 'idle',
            walletResult: props.isConnected ? makeSuccessResult() : makeErrorResult(),
            v3SdkFailed: false,
            v4SdkFailed: false,
            reserves: emptyReserves,
            portfolioActions: mockPortfolioActions,
          }),
        { initialProps: { isConnected: true } },
      )

      rerender({ isConnected: false })

      expect(toast.info).toHaveBeenCalledWith('Removed 2 wallet positions')
    })

    it('does not show toast when zero wallet entries removed', () => {
      mockRemoveWalletEntries.mockReturnValue(0)

      const { rerender } = renderHook(
        (props: { isConnected: boolean }) =>
          useWalletAutoImport({
            address: props.isConnected ? address : undefined,
            isConnected: props.isConnected,
            walletLoadState: props.isConnected ? 'success' : 'idle',
            walletResult: props.isConnected ? makeSuccessResult() : makeErrorResult(),
            v3SdkFailed: false,
            v4SdkFailed: false,
            reserves: emptyReserves,
            portfolioActions: mockPortfolioActions,
          }),
        { initialProps: { isConnected: true } },
      )

      rerender({ isConnected: false })

      expect(toast.info).not.toHaveBeenCalledWith(expect.stringContaining('wallet position'))
    })

    it('calls onDisconnect callback when wallet disconnects', () => {
      const onDisconnect = vi.fn()

      const { rerender } = renderHook(
        (props: { isConnected: boolean }) =>
          useWalletAutoImport({
            address: props.isConnected ? address : undefined,
            isConnected: props.isConnected,
            walletLoadState: props.isConnected ? 'success' : 'idle',
            walletResult: props.isConnected ? makeSuccessResult() : makeErrorResult(),
            v3SdkFailed: false,
            v4SdkFailed: false,
            reserves: emptyReserves,
            portfolioActions: mockPortfolioActions,
            onDisconnect,
          }),
        { initialProps: { isConnected: true } },
      )

      expect(onDisconnect).not.toHaveBeenCalled()

      rerender({ isConnected: false })

      expect(onDisconnect).toHaveBeenCalledTimes(1)
    })

    it('does not call onDisconnect when wallet is already disconnected', () => {
      const onDisconnect = vi.fn()

      renderHook(() =>
        useWalletAutoImport({
          address: undefined,
          isConnected: false,
          walletLoadState: 'idle',
          walletResult: makeErrorResult(),
          v3SdkFailed: false,
          v4SdkFailed: false,
          reserves: emptyReserves,
          portfolioActions: mockPortfolioActions,
          onDisconnect,
        }),
      )

      expect(onDisconnect).not.toHaveBeenCalled()
    })

    it('calls onDisconnect before re-import on reconnect', () => {
      const onDisconnect = vi.fn()
      const onImport = vi.fn()
      const walletPositions = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]

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
            onImport,
            onDisconnect,
          }),
        { initialProps: { isConnected: true } },
      )

      expect(onImport).toHaveBeenCalledTimes(1)
      expect(onDisconnect).not.toHaveBeenCalled()

      rerender({ isConnected: false })

      expect(onDisconnect).toHaveBeenCalledTimes(1)

      rerender({ isConnected: true })

      expect(onImport).toHaveBeenCalledTimes(2)
    })

    it('calls onDisconnect on multiple connect/disconnect cycles', () => {
      const onDisconnect = vi.fn()
      const walletPositions = [{ reserveId: 'r1', side: 'supply' }] as unknown as WalletPosition[]

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
            onDisconnect,
          }),
        { initialProps: { isConnected: false } },
      )

      expect(onDisconnect).toHaveBeenCalledTimes(0)

      rerender({ isConnected: true })
      rerender({ isConnected: false })
      expect(onDisconnect).toHaveBeenCalledTimes(1)

      rerender({ isConnected: true })
      rerender({ isConnected: false })
      expect(onDisconnect).toHaveBeenCalledTimes(2)
    })
  })
})
