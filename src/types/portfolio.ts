/** Portfolio Simulation data model — Phase 1 types. */

export type PortfolioSide = 'supply' | 'borrow';
export type PortfolioInputMode = 'usd' | 'token';

/** Wallet sync visual tri-state for a position row. */
export type WalletSyncState = 'synced' | 'modified' | 'manual';

/** Source of the position data — SDK preferred, onchain viem fallback, or manual entry. */
export type PositionSource = 'sdk' | 'onchain-v3' | 'onchain-v4' | 'gap-v3' | 'gap-v4' | 'manual';

export type DeltaSign = 1 | -1;

/** Per-side data within a reserve entry. Always present — never null. */
export interface PortfolioSideData {
  /** Raw user input string (allows empty / partial). */
  amount: string;
  inputMode: PortfolioInputMode;
  /** Wallet-synced onchain USD value. null = not from wallet (manual entry). */
  walletValue: number | null;
  /** Data source of this side — SDK preferred, onchain viem fallback, or manual entry. */
  source?: PositionSource;
  /** Explicit delta sign for wallet-synced positions: 1 = positive (adding), -1 = negative (reducing). Default 1. */
  deltaSign?: DeltaSign;
}

/** Patch object for updateReserve — only specified fields are changed. */
export interface ReservePatch {
  supplyAmount?: string;
  supplyInputMode?: PortfolioInputMode;
  borrowAmount?: string;
  borrowInputMode?: PortfolioInputMode;
}

/** A reserve-level portfolio entry (one token, supply + borrow together). */
export interface PortfolioReserveEntry {
  reserveId: string;
  marketName: string;
  chainName: string;
  tokenSymbol: string;
  supply: PortfolioSideData;
  borrow: PortfolioSideData;
  /** Soft delete flag. Hidden entries are grayed + sunk to bottom. */
  hidden: boolean;
  /** Whether this entry is an orphan (reserveId not found in market data). */
  isOrphan: boolean;
}

/** @deprecated Use PortfolioReserveEntry instead. */
export interface PortfolioPosition {
  /** Unique key for this position within the portfolio (client-generated). */
  positionId: string;
  /** Canonical reserve key from market data; frontend falls back to the composite key when missing. */
  reserveId: string;
  /** Market name for display and lookup (e.g. "AaveV3Ethereum"). */
  marketName: string;
  /** Chain name for display (e.g. "Ethereum"). */
  chainName: string;
  /** Token symbol for display (e.g. "USDC"). */
  tokenSymbol: string;
  side: PortfolioSide;
  /** Raw user input string (allows empty / partial). */
  amount: string;
  inputMode: PortfolioInputMode;
  /** Wallet-synced onchain USD value. null = not from wallet (manual entry). */
  walletValue: number | null;
  /** Soft delete flag. Hidden positions are grayed + sunk to bottom. */
  hidden: boolean;
  /** Whether this position is an orphan (reserveId not found in market data). */
  isOrphan: boolean;
  /** Data source of this position — SDK preferred, onchain viem fallback, or manual entry. */
  source?: PositionSource;
  /** Explicit delta sign for wallet-synced positions: 1 = positive (adding), -1 = negative (reducing). Default 1. */
  deltaSign?: DeltaSign;
}

/** Computed result for a single side after simulation. */
export interface PortfolioPositionResult {
  reserveId: string;
  side: PortfolioSide;
  /** USD value of position (resolved from token amount × price or direct USD input). */
  amountUsd: number;
  /** Native APY/APR percent after simulation (supply or borrow side). */
  nativePercent: number;
  /** Incentive APR/APY percent after simulation. */
  incentivePercent: number;
  /** Total = native + incentive. */
  totalPercent: number;
  /** Estimated USD earned (supply) or paid (borrow) per day. */
  usdPerDay: number;
}

/** Aggregated portfolio summary. */
export interface PortfolioSummary {
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  /** Σ supply earn/day. */
  supplyUsdPerDay: number;
  /** Σ borrow cost/day (positive = cost). */
  borrowUsdPerDay: number;
  /** supply earn − borrow cost. */
  netUsdPerDay: number;
  /** Annualized: netUsdPerDay × 365 / totalSupplyUsd (or 0 when no supply). */
  netEffectiveApy: number;
}

/** A saved snapshot for comparison. */
export interface PortfolioSnapshot {
  id: string;
  label: string;
  createdAt: number;
  entries: PortfolioReserveEntry[];
  /** @deprecated Derived from entries. Use entries instead. */
  positions?: PortfolioPosition[];
  summary: PortfolioSummary;
  positionResults: PortfolioPositionResult[];
}

/** Full portfolio state. */
export interface PortfolioState {
  /** Whether portfolio mode is active. */
  active: boolean;
  entries: PortfolioReserveEntry[];
  savedSnapshots: PortfolioSnapshot[];
}
