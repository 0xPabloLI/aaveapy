import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';

type SortMode = 'total' | 'native' | 'incentive';
type SortableColumn = 'token' | 'price' | 'market' | 'size' | 'util' | 'supply' | 'borrow' | 'spread';
type SizeSortMode = 'supply' | 'borrow' | 'deficitRatio' | 'deficitAmount';

interface MenuPos {
  top: number;
  left: number;
}

interface ReservesTableDesktopHeaderProps {
  tableHeaderRef: RefObject<HTMLTableSectionElement | null>;
  tableHeaderClassName: string;
  activeSortColumn: SortableColumn | null;
  tokenSortOrder: 'asc' | 'desc';
  marketSortOrder: 'asc' | 'desc';
  priceSortOrder: 'asc' | 'desc';
  sizeSortMode: SizeSortMode;
  sizeSortOrder: 'asc' | 'desc';
  sizeSortActiveHeadingClass: string;
  utilSortOrder: 'asc' | 'desc';
  supplySortLabel: string;
  supplySortMode: SortMode;
  supplySortOrder: 'asc' | 'desc';
  showSupplySortMenu: boolean;
  supplyMenuPos: MenuPos | null;
  borrowSortLabel: string;
  borrowSortMode: SortMode;
  borrowSortOrder: 'asc' | 'desc';
  showBorrowSortMenu: boolean;
  borrowMenuPos: MenuPos | null;
  spreadSortOrder: 'asc' | 'desc';
  showSizeSortMenu: boolean;
  sizeMenuPos: MenuPos | null;
  sizeSortButtonRef: RefObject<HTMLButtonElement | null>;
  supplySortButtonRef: RefObject<HTMLButtonElement | null>;
  borrowSortButtonRef: RefObject<HTMLButtonElement | null>;
  onSortToken: () => void;
  onSortMarket: () => void;
  onSortPrice: () => void;
  onSortUtil: () => void;
  onToggleSpreadSort: () => void;
  onToggleSizeMenu: () => void;
  onCloseSizeMenu: () => void;
  onSelectSizeSortSupply: () => void;
  onSelectSizeSortBorrow: () => void;
  onSelectSizeSortDeficitAmount: () => void;
  onSelectSizeSortDeficitRatio: () => void;
  onToggleSupplyMenu: () => void;
  onCloseSupplyMenu: () => void;
  onSelectSupplySortTotal: () => void;
  onSelectSupplySortNative: () => void;
  onSelectSupplySortIncentive: () => void;
  onToggleBorrowMenu: () => void;
  onCloseBorrowMenu: () => void;
  onSelectBorrowSortTotal: () => void;
  onSelectBorrowSortNative: () => void;
  onSelectBorrowSortIncentive: () => void;
}

export default function ReservesTableDesktopHeader({
  tableHeaderRef,
  tableHeaderClassName,
  activeSortColumn,
  tokenSortOrder,
  marketSortOrder,
  priceSortOrder,
  sizeSortMode,
  sizeSortOrder,
  sizeSortActiveHeadingClass,
  utilSortOrder,
  supplySortLabel,
  supplySortMode,
  supplySortOrder,
  showSupplySortMenu,
  supplyMenuPos,
  borrowSortLabel,
  borrowSortMode,
  borrowSortOrder,
  showBorrowSortMenu,
  borrowMenuPos,
  spreadSortOrder,
  showSizeSortMenu,
  sizeMenuPos,
  sizeSortButtonRef,
  supplySortButtonRef,
  borrowSortButtonRef,
  onSortToken,
  onSortMarket,
  onSortPrice,
  onSortUtil,
  onToggleSpreadSort,
  onToggleSizeMenu,
  onCloseSizeMenu,
  onSelectSizeSortSupply,
  onSelectSizeSortBorrow,
  onSelectSizeSortDeficitAmount,
  onSelectSizeSortDeficitRatio,
  onToggleSupplyMenu,
  onCloseSupplyMenu,
  onSelectSupplySortTotal,
  onSelectSupplySortNative,
  onSelectSupplySortIncentive,
  onToggleBorrowMenu,
  onCloseBorrowMenu,
  onSelectBorrowSortTotal,
  onSelectBorrowSortNative,
  onSelectBorrowSortIncentive,
}: ReservesTableDesktopHeaderProps) {
  return (
    <TableHeader
      ref={tableHeaderRef}
      data-reserves-sticky-thead
      className={tableHeaderClassName}
    >
      <TableRow className="border-b border-border/50 hover:bg-transparent">
        <TableHead className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-0-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground">
          <button
            type="button"
            onClick={onSortToken}
            className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
              activeSortColumn === 'token'
                ? 'text-foreground font-bold scale-105'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <span>Token</span>
            {activeSortColumn === 'token' ? (
              tokenSortOrder === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )
            ) : (
              <ArrowDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        </TableHead>
        <TableHead className="px-[var(--ds-space-0-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
          <button
            type="button"
            onClick={onSortPrice}
            className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
              activeSortColumn === 'price'
                ? 'text-foreground font-bold scale-105'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <span>Price</span>
            {activeSortColumn === 'price' ? (
              priceSortOrder === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )
            ) : (
              <ArrowDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        </TableHead>
        <TableHead className="pl-[var(--ds-space-0-5)] pr-[var(--ds-space-1)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
          <button
            type="button"
            onClick={onSortMarket}
            className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
              activeSortColumn === 'market'
                ? 'text-foreground font-bold scale-105'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <span>Market</span>
            {activeSortColumn === 'market' ? (
              marketSortOrder === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )
            ) : (
              <ArrowDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        </TableHead>
        <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center hidden md:table-cell">
          <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
            <div className="flex items-center gap-[var(--ds-space-1-5)]">
              <span
                className={`transition-all duration-200 ${activeSortColumn === 'size' ? sizeSortActiveHeadingClass : 'text-muted-foreground'}`}
              >
                Size
              </span>
              <div className="relative">
                <button
                  ref={sizeSortButtonRef}
                  type="button"
                  onClick={onToggleSizeMenu}
                  className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                    showSizeSortMenu || activeSortColumn === 'size'
                      ? 'bg-card/60 border-border/70 text-foreground'
                      : 'bg-card/60 border-border/70 text-muted-foreground'
                  }`}
                  title="Select size sort field"
                >
                  <span className="font-semibold">
                    {sizeSortMode === 'supply'
                      ? 'Supply'
                      : sizeSortMode === 'borrow'
                        ? 'Borrow'
                        : sizeSortMode === 'deficitRatio'
                          ? 'Deficit (%)'
                          : 'Deficit'}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showSizeSortMenu && sizeMenuPos && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9999]"
                      onClick={onCloseSizeMenu}
                    />
                    <div
                      className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[160px]"
                      style={{ top: sizeMenuPos.top, left: sizeMenuPos.left }}
                    >
                      <button
                        type="button"
                        onClick={onSelectSizeSortSupply}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                          sizeSortMode === 'supply' && activeSortColumn === 'size'
                            ? 'ds-text-emerald-600 font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Supply</span>
                        {sizeSortMode === 'supply' && activeSortColumn === 'size' ? (
                          sizeSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectSizeSortBorrow}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                          sizeSortMode === 'borrow' && activeSortColumn === 'size'
                            ? 'ds-text-brand-cyan font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Borrow</span>
                        {sizeSortMode === 'borrow' && activeSortColumn === 'size' ? (
                          sizeSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectSizeSortDeficitAmount}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                          sizeSortMode === 'deficitAmount' && activeSortColumn === 'size'
                            ? 'text-foreground font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Deficit</span>
                        {sizeSortMode === 'deficitAmount' && activeSortColumn === 'size' ? (
                          sizeSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowUp className="w-3 h-3 text-foreground" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectSizeSortDeficitRatio}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                          sizeSortMode === 'deficitRatio' && activeSortColumn === 'size'
                            ? 'text-foreground font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Deficit (%)</span>
                        {sizeSortMode === 'deficitRatio' && activeSortColumn === 'size' ? (
                          sizeSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowUp className="w-3 h-3 text-foreground" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
              </div>
            </div>
          </div>
        </TableHead>
        <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
          <button
            type="button"
            onClick={onSortUtil}
            className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
              activeSortColumn === 'util'
                ? 'text-foreground font-bold scale-105'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <span>Utilization</span>
            {activeSortColumn === 'util' ? (
              utilSortOrder === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )
            ) : (
              <ArrowDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        </TableHead>
        <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
          <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
            <div className="flex items-center gap-[var(--ds-space-1-5)]">
              <span
                className={`transition-all duration-200 ${activeSortColumn === 'supply' ? 'ds-text-emerald-600 font-bold scale-105' : 'text-muted-foreground'}`}
              >
                Supply
              </span>
              <div className="relative">
                <button
                  ref={supplySortButtonRef}
                  type="button"
                  onClick={onToggleSupplyMenu}
                  className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                    showSupplySortMenu || activeSortColumn === 'supply'
                      ? 'bg-card/60 border-border/70 ds-text-emerald-700'
                      : 'bg-card/60 border-border/70 text-muted-foreground'
                  }`}
                  title="Select sort field"
                >
                  <span className="font-semibold">{supplySortLabel}</span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showSupplySortMenu && supplyMenuPos && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9999]"
                      onClick={onCloseSupplyMenu}
                    />
                    <div
                      className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[140px]"
                      style={{ top: supplyMenuPos.top, left: supplyMenuPos.left }}
                    >
                      <button
                        type="button"
                        onClick={onSelectSupplySortTotal}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                          supplySortMode === 'total' && activeSortColumn === 'supply'
                            ? 'ds-text-emerald-600 font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Total</span>
                        {supplySortMode === 'total' && activeSortColumn === 'supply' ? (
                          supplySortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectSupplySortNative}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                          supplySortMode === 'native' && activeSortColumn === 'supply'
                            ? 'ds-text-emerald-600 font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Native</span>
                        {supplySortMode === 'native' && activeSortColumn === 'supply' ? (
                          supplySortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectSupplySortIncentive}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                          supplySortMode === 'incentive' && activeSortColumn === 'supply'
                            ? 'ds-text-emerald-600 font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Incentive</span>
                        {supplySortMode === 'incentive' && activeSortColumn === 'supply' ? (
                          supplySortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
              </div>
            </div>
          </div>
        </TableHead>
        <TableHead className="px-[var(--ds-space-1-5)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
          <button
            type="button"
            onClick={onToggleSpreadSort}
            className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-all duration-200 ${
              activeSortColumn === 'spread' ? 'ds-text-purple-600 font-bold scale-105' : 'text-muted-foreground'
            }`}
          >
            <span>Spread</span>
            {activeSortColumn === 'spread' ? (
              spreadSortOrder === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )
            ) : (
              <ArrowDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        </TableHead>
        <TableHead className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-2)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
          <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
            <div className="flex items-center gap-[var(--ds-space-1-5)]">
              <span
                className={`transition-all duration-200 ${activeSortColumn === 'borrow' ? 'ds-text-brand-cyan font-bold scale-105' : 'text-muted-foreground'}`}
              >
                Borrow
              </span>
              <div className="relative">
                <button
                  ref={borrowSortButtonRef}
                  type="button"
                  onClick={onToggleBorrowMenu}
                  className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                    showBorrowSortMenu || activeSortColumn === 'borrow'
                      ? 'bg-card/60 border-border/70 ds-text-brand-cyan'
                      : 'bg-card/60 border-border/70 text-muted-foreground'
                  }`}
                  title="Select sort field"
                >
                  <span className="font-semibold">{borrowSortLabel}</span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showBorrowSortMenu && borrowMenuPos && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9999]"
                      onClick={onCloseBorrowMenu}
                    />
                    <div
                      className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000] min-w-[140px]"
                      style={{ top: borrowMenuPos.top, left: borrowMenuPos.left }}
                    >
                      <button
                        type="button"
                        onClick={onSelectBorrowSortTotal}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                          borrowSortMode === 'total' && activeSortColumn === 'borrow'
                            ? 'ds-text-brand-cyan font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Total</span>
                        {borrowSortMode === 'total' && activeSortColumn === 'borrow' ? (
                          borrowSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectBorrowSortNative}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                          borrowSortMode === 'native' && activeSortColumn === 'borrow'
                            ? 'ds-text-brand-cyan font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Native</span>
                        {borrowSortMode === 'native' && activeSortColumn === 'borrow' ? (
                          borrowSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onSelectBorrowSortIncentive}
                        className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                          borrowSortMode === 'incentive' && activeSortColumn === 'borrow'
                            ? 'ds-text-brand-cyan font-bold bg-card/60'
                            : 'text-foreground/80'
                        }`}
                      >
                        <span>Sort by Incentive</span>
                        {borrowSortMode === 'incentive' && activeSortColumn === 'borrow' ? (
                          borrowSortOrder === 'desc' ? (
                            <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                          ) : (
                            <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                          )
                        ) : (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                        )}
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
              </div>
            </div>
          </div>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
