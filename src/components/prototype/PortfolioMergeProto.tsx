/**
 * PROTOTYPE — Portfolio Merge UX with wallet-source tracking
 *
 * Each position tracks:
 *   walletValue: number | null  (on-chain value from wallet, null=not in wallet)
 *   currentValue: number        (Simulator current value)
 *   hidden: boolean             (soft delete, re-sync restores; manual = real delete)
 *
 * Three visual states:
 *   🟢 Wallet synced (unchanged): walletValue ≠ null && currentValue === walletValue
 *   🟡 Wallet synced (modified):  walletValue ≠ null && currentValue !== walletValue
 *   ⚪ Manual:                     walletValue === null
 *
 * Hidden positions: grayed out + sunk to bottom, click row to restore
 *
 * Wallet load state: idle / loading / success-empty / success / error
 *
 * Scenarios 1-9b via scenario query param
 * DELETE after decision is captured.
 */
import { useState, useCallback, useEffect } from 'react';
import { Wallet, Check, Plus, Minus, RefreshCw, AlertCircle, Loader2, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Data Model ──────────────────────────────────────────────

interface TrackedPosition {
  id: string;
  symbol: string;
  chain: string;
  side: 'supply' | 'borrow';
  walletValue: number | null;
  currentValue: number;
  hidden?: boolean;
  justReplaced?: boolean;
}

type SourceStatus = 'wallet-synced' | 'wallet-modified' | 'manual';

function getSourceStatus(pos: TrackedPosition): SourceStatus {
  if (pos.walletValue === null) return 'manual';
  if (pos.currentValue === pos.walletValue) return 'wallet-synced';
  return 'wallet-modified';
}

type WalletLoadState = 'idle' | 'loading' | 'success-empty' | 'success' | 'error';

// ─── Position Row ────────────────────────────────────────────

function TrackedPositionRow({
  pos,
  onChange,
  onRestore,
  onRemove,
  onToggleHidden,
}: {
  pos: TrackedPosition;
  onChange: (id: string, value: number) => void;
  onRestore: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleHidden: (id: string) => void;
}) {
  const status = getSourceStatus(pos);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(pos.currentValue));

  const handleStartEdit = useCallback(() => {
    if (pos.hidden) return;
    setInputVal(String(pos.currentValue));
    setEditing(true);
  }, [pos.currentValue, pos.hidden]);

  const handleCommit = useCallback(() => {
    const v = parseFloat(inputVal);
    if (!isNaN(v) && v >= 0) {
      onChange(pos.id, v);
    }
    setEditing(false);
  }, [inputVal, onChange, pos.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  }, [handleCommit]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300',
        pos.hidden
          ? 'border-border/20 bg-muted/5 opacity-40'
          : pos.justReplaced
            ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
            : 'border-border/40 bg-card/50',
        !pos.hidden && status === 'wallet-synced' && 'border-emerald-500/20',
        !pos.hidden && status === 'wallet-modified' && 'border-amber-500/30',
        pos.hidden && 'cursor-pointer hover:opacity-60',
      )}
      onClick={pos.hidden ? () => onToggleHidden(pos.id) : undefined}
    >
      {/* Side dot */}
      <div className={cn(
        'w-2 h-2 rounded-full shrink-0',
        pos.side === 'supply' ? 'bg-emerald-500' : 'bg-orange-500',
      )} />

      {/* Symbol + Chain + Side */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="ds-text-13 font-medium text-foreground">{pos.symbol}</span>
          <span className="ds-text-11 text-muted-foreground">{pos.chain}</span>
          <span className={cn(
            'ds-text-10 font-medium px-1 rounded',
            pos.side === 'supply' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600',
          )}>{pos.side}</span>
        </div>
      </div>

      {/* Value */}
      {pos.hidden ? (
        <span className="ds-text-13 font-medium text-muted-foreground tabular-nums line-through">
          ${fmt(pos.currentValue)}
        </span>
      ) : editing ? (
        <input
          type="number"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className="w-24 ds-text-12 font-medium text-foreground bg-muted/30 rounded px-1.5 py-0.5 tabular-nums outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      ) : (
        <button
          onClick={handleStartEdit}
          className="ds-text-13 font-medium text-foreground tabular-nums hover:underline cursor-pointer"
        >
          ${fmt(pos.currentValue)}
        </button>
      )}

      {/* Source indicator */}
      {!pos.hidden && status === 'wallet-synced' && (
        <div className="group relative" title="Synced from wallet">
          <Wallet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        </div>
      )}
      {!pos.hidden && status === 'wallet-modified' && (
        <button
          onClick={() => onRestore(pos.id)}
          className="group relative shrink-0"
          title={`Modified, wallet value $${fmt(pos.walletValue!)}, click to restore`}
        >
          <div className="relative">
            <Wallet className="w-3.5 h-3.5 text-amber-500" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-card" />
          </div>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap ds-text-10 bg-foreground text-background px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Wallet ${fmt(pos.walletValue!)} — click to restore
          </span>
        </button>
      )}
      {/* Manual: invisible placeholder for column alignment (decision #24) */}
      {!pos.hidden && status === 'manual' && (
        <div className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      )}

      {/* Remove / hide toggle */}
      {!pos.hidden && (
        <button
          onClick={() => onRemove(pos.id)}
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={status !== 'manual' ? 'Hide (restores on re-sync)' : 'Delete'}
        >
          <Minus className="w-3 h-3" />
        </button>
      )}

      {/* Hidden indicator: wallet icon first, then EyeOff (decision #21b) */}
      {pos.hidden && (
        <div className="flex items-center gap-1.5 text-muted-foreground" title="Click row to restore">
          {status === 'wallet-synced' && (
            <Wallet className="w-3 h-3 text-emerald-500/60 shrink-0" />
          )}
          {status === 'wallet-modified' && (
            <Wallet className="w-3 h-3 text-amber-500/60 shrink-0" />
          )}
          {status === 'manual' && (
            <span className="ds-text-10">manual</span>
          )}
          <EyeOff className="w-3 h-3 shrink-0" />
        </div>
      )}
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────

function SyncToast({ message, sub, onClose }: { message: string; sub: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-lg border border-emerald-500/30 bg-card shadow-lg px-4 py-3 flex items-center gap-3 max-w-xs">
        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <p className="ds-text-13 font-medium text-foreground">{message}</p>
          <p className="ds-text-11 text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Logic ────────────────────────────────────────────

interface WalletPosition {
  id: string;
  symbol: string;
  chain: string;
  side: 'supply' | 'borrow';
  usdValue: number;
}

function mergePositions(
  current: TrackedPosition[],
  wallet: WalletPosition[],
): { merged: TrackedPosition[]; synced: number; updated: number; added: number; restored: number } {
  const walletMap = new Map<string, WalletPosition>();
  for (const wp of wallet) {
    walletMap.set(wp.id, wp);
  }

  let synced = 0;
  let updated = 0;
  let added = 0;
  let restored = 0;

  const existingMap = new Map<string, TrackedPosition>();
  for (const p of current) {
    existingMap.set(p.id, p);
  }

  const result: TrackedPosition[] = [];

  for (const [id, wp] of walletMap) {
    const existing = existingMap.get(id);
    if (existing) {
      const wasHidden = existing.hidden;
      const wasModified = existing.walletValue !== null && existing.currentValue !== existing.walletValue;
      if (wasHidden) {
        restored++;
      } else if (wasModified || existing.walletValue === null) {
        updated++;
      } else {
        synced++;
      }
      result.push({
        ...existing,
        walletValue: wp.usdValue,
        currentValue: wp.usdValue,
        hidden: false,
        justReplaced: true,
      });
    } else {
      added++;
      result.push({
        id: wp.id,
        symbol: wp.symbol,
        chain: wp.chain,
        side: wp.side,
        walletValue: wp.usdValue,
        currentValue: wp.usdValue,
        justReplaced: true,
      });
    }
  }

  for (const [id, ep] of existingMap) {
    if (!walletMap.has(id)) {
      result.push({ ...ep, justReplaced: false });
    }
  }

  return { merged: result, synced: synced + added, updated, added, restored };
}

// ─── Wallet Data ────────────────────────────────────────────

const WALLET_POSITIONS: WalletPosition[] = [
  { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', usdValue: 5000 },
  { id: 'wbtc-supply', symbol: 'WBTC', chain: 'Ethereum', side: 'supply', usdValue: 3000 },
  { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', usdValue: 1200 },
];

const WALLET_POSITIONS_V2: WalletPosition[] = [
  { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', usdValue: 6000 },
  { id: 'wbtc-supply', symbol: 'WBTC', chain: 'Ethereum', side: 'supply', usdValue: 3000 },
  { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', usdValue: 1200 },
  { id: 'link-supply', symbol: 'LINK', chain: 'Ethereum', side: 'supply', usdValue: 900 },
];

const WALLET_EMPTY: WalletPosition[] = [];

// ─── Scenario Data ──────────────────────────────────────────

interface ScenarioConfig {
  label: string;
  desc: string;
  initialPositions: TrackedPosition[];
  walletData: WalletPosition[];
  simulateError?: boolean;
  simulateEmpty?: boolean;
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  '1': {
    label: 'Empty Simulator → Connect wallet import',
    desc: 'No positions in Simulator, 3 on-chain positions imported',
    initialPositions: [],
    walletData: WALLET_POSITIONS,
  },
  '2': {
    label: 'Existing positions → Import (replace + add + keep)',
    desc: 'Simulator has ETH Supply $2K + USDC Borrow $800 + DAI Supply $4K, wallet has ETH $5K + WBTC $3K + USDC $1.2K',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: null, currentValue: 2000 },
      { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', walletValue: null, currentValue: 800 },
      { id: 'dai-supply', symbol: 'DAI', chain: 'Ethereum', side: 'supply', walletValue: null, currentValue: 4000 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '3': {
    label: 'User modifies synced value after import',
    desc: 'After import ETH Supply = $5K 🟢, user changes to $8K → 🟡',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 5000 },
      { id: 'wbtc-supply', symbol: 'WBTC', chain: 'Ethereum', side: 'supply', walletValue: 3000, currentValue: 3000 },
      { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', walletValue: 1200, currentValue: 1200 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '4': {
    label: 'User reverts to wallet value',
    desc: 'ETH Supply 🟡 $8K → manually enter $5K → back to 🟢',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 8000 },
      { id: 'wbtc-supply', symbol: 'WBTC', chain: 'Ethereum', side: 'supply', walletValue: 3000, currentValue: 3000 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '5': {
    label: 'User adds manual position after import',
    desc: 'Add LINK Supply $600 beside imported positions (⚪ manual)',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 5000 },
      { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', walletValue: 1200, currentValue: 1200 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '6': {
    label: 'Soft-delete wallet-synced position',
    desc: 'Click minus → grayed out + sunk to bottom, click row to restore, re-sync also restores',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 5000 },
      { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', walletValue: 1200, currentValue: 1200 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '7': {
    label: 'Re-sync (on-chain value changed → overwrite)',
    desc: 'ETH Supply 🟡 $8K (wallet=$5K), on-chain becomes $6K → after sync $6K 🟢',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 8000 },
      { id: 'wbtc-supply', symbol: 'WBTC', chain: 'Ethereum', side: 'supply', walletValue: 3000, currentValue: 3000 },
    ],
    walletData: WALLET_POSITIONS_V2,
  },
  '8': {
    label: 'Soft-delete + Re-sync restores',
    desc: 'Hide ETH Supply → click Sync → ETH auto-restores with on-chain value',
    initialPositions: [
      { id: 'eth-supply', symbol: 'ETH', chain: 'Ethereum', side: 'supply', walletValue: 5000, currentValue: 5000, hidden: true },
      { id: 'usdc-borrow', symbol: 'USDC', chain: 'Ethereum', side: 'borrow', walletValue: 1200, currentValue: 1200 },
    ],
    walletData: WALLET_POSITIONS,
  },
  '9a1': {
    label: 'On-chain 0 positions (empty Simulator)',
    desc: 'Connect wallet → no on-chain positions → green confirmation',
    initialPositions: [],
    walletData: WALLET_EMPTY,
    simulateEmpty: true,
  },
  '9a2': {
    label: 'On-chain 0 positions (has manual positions)',
    desc: 'Simulator has manual positions, on-chain has none → green confirmation, existing positions kept',
    initialPositions: [
      { id: 'dai-supply', symbol: 'DAI', chain: 'Ethereum', side: 'supply', walletValue: null, currentValue: 4000 },
      { id: 'link-supply', symbol: 'LINK', chain: 'Ethereum', side: 'supply', walletValue: null, currentValue: 600 },
    ],
    walletData: WALLET_EMPTY,
    simulateEmpty: true,
  },
  '9b': {
    label: 'SDK failure (error + retry)',
    desc: 'Connect wallet → SDK read failure → orange error + retry button',
    initialPositions: [],
    walletData: WALLET_EMPTY,
    simulateError: true,
  },
};

// ─── Main Component ─────────────────────────────────────────

export function PortfolioMergeProto({ scenario }: { scenario: string }) {
  const config = SCENARIOS[scenario] ?? SCENARIOS['1'];
  const [positions, setPositions] = useState<TrackedPosition[]>(config.initialPositions);
  const [connected, setConnected] = useState(false);
  const [walletLoadState, setWalletLoadState] = useState<WalletLoadState>('idle');
  const [toast, setToast] = useState<{ message: string; sub: string } | null>(null);
  const [nextId, setNextId] = useState(100);
  const [highlightCleared, setHighlightCleared] = useState(false);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Active positions (not hidden), hidden positions for bottom display
  const activePositions = positions.filter(p => !p.hidden);
  const hiddenPositions = positions.filter(p => p.hidden);

  useEffect(() => {
    setPositions(config.initialPositions);
    setConnected(false);
    setWalletLoadState('idle');
    setToast(null);
    setHighlightCleared(false);
    setShowEmptyConfirm(false);
  }, [scenario]);

  useEffect(() => {
    const hasHighlight = positions.some(p => p.justReplaced);
    if (hasHighlight && !highlightCleared) {
      const t = setTimeout(() => {
        setPositions(prev => prev.map(p => ({ ...p, justReplaced: false })));
        setHighlightCleared(true);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [positions, highlightCleared]);

  useEffect(() => {
    if (showEmptyConfirm) {
      const t = setTimeout(() => setShowEmptyConfirm(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showEmptyConfirm]);

  const doSync = useCallback((walletData: WalletPosition[]) => {
    const { merged, synced, updated, restored } = mergePositions(positions, walletData);
    setPositions(merged);
    setHighlightCleared(false);
    const parts: string[] = [];
    if (synced > 0) parts.push(`${synced} synced`);
    if (updated > 0) parts.push(`${updated} updated to on-chain`);
    if (restored > 0) parts.push(`${restored} hidden restored`);
    setToast({
      message: synced > 0 || restored > 0 ? `Synced ${synced + restored} positions from wallet` : 'Portfolio updated',
      sub: parts.join(', ') || 'No changes',
    });
  }, [positions]);

  const handleConnect = useCallback(() => {
    setWalletLoadState('loading');
    setTimeout(() => {
      if (config.simulateError) {
        setWalletLoadState('error');
        setConnected(true);
        return;
      }
      if (config.simulateEmpty || config.walletData.length === 0) {
        setWalletLoadState('success-empty');
        setConnected(true);
        setShowEmptyConfirm(true);
        return;
      }
      setConnected(true);
      setWalletLoadState('success');
      doSync(config.walletData);
    }, 800);
  }, [config, doSync]);

  const handleReSync = useCallback(() => {
    if (walletLoadState === 'error') {
      setWalletLoadState('loading');
      setTimeout(() => {
        if (config.simulateError) {
          setWalletLoadState('error');
          return;
        }
        setWalletLoadState(config.walletData.length === 0 ? 'success-empty' : 'success');
        if (config.walletData.length === 0) setShowEmptyConfirm(true);
        if (config.walletData.length > 0) doSync(config.walletData);
      }, 800);
      return;
    }
    setWalletLoadState('loading');
    setTimeout(() => {
      setWalletLoadState(config.walletData.length === 0 ? 'success-empty' : 'success');
      if (config.walletData.length === 0) setShowEmptyConfirm(true);
      if (config.walletData.length > 0) doSync(config.walletData);
    }, 600);
  }, [config, doSync, walletLoadState]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setWalletLoadState('idle');
  }, []);

  const handleChange = useCallback((id: string, value: number) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, currentValue: value } : p));
  }, []);

  const handleRestore = useCallback((id: string) => {
    setPositions(prev => prev.map(p => {
      if (p.id !== id || p.walletValue === null) return p;
      return { ...p, currentValue: p.walletValue };
    }));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPositions(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;
      if (target.walletValue === null) {
        return prev.filter(p => p.id !== id);
      }
      return prev.map(p => p.id === id ? { ...p, hidden: true } : p);
    });
  }, []);

  const handleToggleHidden = useCallback((id: string) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, hidden: false } : p));
  }, []);

  const handleAddManual = useCallback(() => {
    const newId = `manual-${nextId}`;
    setNextId(prev => prev + 1);
    setPositions(prev => [...prev, {
      id: newId,
      symbol: 'LINK',
      chain: 'Ethereum',
      side: 'supply' as const,
      walletValue: null,
      currentValue: 600,
    }]);
  }, [nextId]);

  const totalSupply = activePositions
    .filter(p => p.side === 'supply')
    .reduce((s, p) => s + p.currentValue, 0);
  const totalBorrow = activePositions
    .filter(p => p.side === 'borrow')
    .reduce((s, p) => s + p.currentValue, 0);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="ds-text-16 font-semibold text-foreground">Portfolio Simulation</h2>
          {activePositions.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 h-5 rounded-full bg-primary/10 text-primary ds-text-10 font-semibold">
              {activePositions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddManual}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 ds-text-12 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add manual
          </button>
          {!connected ? (
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground ds-text-13 font-medium hover:bg-primary/90 transition-colors"
            >
              <Wallet className="w-4 h-4" /> Connect
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 ds-text-11 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 0x1a2b…9f3e
              </span>
              <button
                onClick={handleReSync}
                disabled={walletLoadState === 'loading'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 ds-text-12 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
                title="Re-sync on-chain positions"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', walletLoadState === 'loading' && 'animate-spin')} /> Sync
              </button>
              <button onClick={handleDisconnect} className="ds-text-11 text-muted-foreground hover:text-foreground transition-colors">
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scenario info */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-5 rounded-full bg-primary text-primary-foreground ds-text-10 font-bold">{scenario}</span>
          <span className="ds-text-13 font-medium text-foreground">{config.label}</span>
        </div>
        <p className="ds-text-12 text-muted-foreground">{config.desc}</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 ds-text-11 text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><Wallet className="w-3 h-3 text-emerald-500" /> Synced</span>
        <span className="flex items-center gap-1">
          <span className="relative"><Wallet className="w-3 h-3 text-amber-500" /><span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 border border-card" /></span>
          Modified (restore)
        </span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-border/60" /> Manual</span>
        <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Hidden (click to restore)</span>
      </div>

      {/* Sync button states spec (decision #23/#25) */}
      <div className="rounded-lg border border-border/30 bg-muted/5 px-3 py-2 space-y-2">
        <div className="ds-text-11 font-medium text-muted-foreground">Wallet Sync Button States (freshness dot)</div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 ds-text-12 text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5" /> Sync
            </button>
            <span className="ds-text-10 text-muted-foreground">idle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 ds-text-12 text-muted-foreground opacity-60" disabled>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sync
            </button>
            <span className="ds-text-10 text-muted-foreground">loading</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 ds-text-12 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" /> Sync
              </button>
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-card/80" />
            </div>
            <span className="ds-text-10 text-muted-foreground">has-update (fresh dot)</span>
          </div>
        </div>
        <div className="ds-text-10 text-muted-foreground/70 space-y-0.5">
          <p>Two buttons exist: Wallet Sync (here) + Market Refresh (ReservesTablePagination). Each has independent freshness dot (#25)</p>
          <p>Click either → both syncs fire in parallel. First result updates first, neither blocks the other (#25)</p>
          <p>idle = default muted · loading = muted + spin + disabled · has-update = freshness dot (emerald/amber/red by age)</p>
          <p>Freshness dot = same mechanism as ReservesTablePagination · dot clears after 3s or on click</p>
        </div>
      </div>

      {/* Wallet load state feedback */}
      {connected && walletLoadState === 'loading' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 bg-muted/10 ds-text-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading on-chain positions…
        </div>
      )}
      {connected && walletLoadState === 'success-empty' && showEmptyConfirm && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 ds-text-12 text-emerald-600 animate-out fade-out duration-500">
          <Check className="w-4 h-4 shrink-0" /> No Aave positions found on Ethereum for this wallet
        </div>
      )}
      {connected && walletLoadState === 'error' && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center gap-2 ds-text-12 text-orange-600">
            <AlertCircle className="w-4 h-4 shrink-0" /> Failed to read on-chain positions
          </div>
          <button
            onClick={handleReSync}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-orange-500/30 ds-text-11 text-orange-600 hover:bg-orange-500/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Summary */}
      {activePositions.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-1.5">
            <div className="ds-text-10 text-emerald-600 font-medium">Total Supply</div>
            <div className="ds-text-14 font-semibold text-foreground tabular-nums">${fmt(totalSupply)}</div>
          </div>
          <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 px-2.5 py-1.5">
            <div className="ds-text-10 text-orange-600 font-medium">Total Borrow</div>
            <div className="ds-text-14 font-semibold text-foreground tabular-nums">${fmt(totalBorrow)}</div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-1.5">
            <div className="ds-text-10 text-primary font-medium">Net Supply</div>
            <div className="ds-text-14 font-semibold text-foreground tabular-nums">${fmt(totalSupply - totalBorrow)}</div>
          </div>
        </div>
      )}

      {/* Active position rows */}
      {activePositions.length > 0 ? (
        <div className="space-y-1.5">
          {activePositions.map(pos => (
            <TrackedPositionRow
              key={pos.id}
              pos={pos}
              onChange={handleChange}
              onRestore={handleRestore}
              onRemove={handleRemove}
              onToggleHidden={handleToggleHidden}
            />
          ))}
        </div>
      ) : (
        walletLoadState !== 'loading' && walletLoadState !== 'success-empty' && walletLoadState !== 'error' && (
          <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-center">
            <p className="ds-text-12 text-muted-foreground">No positions yet. Connect wallet to import, or add manually.</p>
          </div>
        )
      )}

      {/* Hidden positions (grayed out, sunk to bottom) */}
      {hiddenPositions.length > 0 && (
        <>
          <div className="flex items-center gap-2 ds-text-10 text-muted-foreground/60">
            <div className="flex-1 h-px bg-border/20" />
            <span>{hiddenPositions.length} hidden</span>
            <div className="flex-1 h-px bg-border/20" />
          </div>
          <div className="space-y-1">
            {hiddenPositions.map(pos => (
              <TrackedPositionRow
                key={pos.id}
                pos={pos}
                onChange={handleChange}
                onRestore={handleRestore}
                onRemove={handleRemove}
                onToggleHidden={handleToggleHidden}
              />
            ))}
          </div>
        </>
      )}

      {/* Action hints */}
      <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 ds-text-12 text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Actions</p>
        <p>Click value to edit · Click 🟡 wallet icon to restore on-chain value · Click "Sync" to re-read chain</p>
        <p>Wallet position minus = hide (restores on sync) · Manual position minus = permanent delete</p>
        <p>Hidden rows are grayed out at the bottom · Click a hidden row to restore it</p>
      </div>

      {/* Toast */}
      {toast && <SyncToast message={toast.message} sub={toast.sub} onClose={() => setToast(null)} />}
    </div>
  );
}

export { SCENARIOS };
