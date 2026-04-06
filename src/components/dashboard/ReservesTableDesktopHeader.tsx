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

interface DesktopSortMenuOption {
  key: string;
  label: string;
  isSelected: boolean;
  order: 'asc' | 'desc';
  activeClassName: string;
  hoverClassName: string;
  onSelect: () => void;
}

const DesktopSortMenuPortal = ({
  open,
  menuPos,
  onClose,
  options,
  minWidth = 140,
}: {
  open: boolean;
  menuPos: MenuPos | null;
  onClose: () => void;
  options: DesktopSortMenuOption[];
  minWidth?: number;
}) => {
  if (!open || !menuPos) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999]"
        onClick={onClose}
      />
      <div
        className="fixed bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-[10000]"
        style={{ top: menuPos.top, left: menuPos.left, minWidth: `${minWidth}px` }}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={option.onSelect}
            className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 transition-colors flex items-center justify-between ${
              option.isSelected
                ? `${option.activeClassName} font-bold bg-card/60`
                : `text-foreground/80 ${option.hoverClassName}`
            }`}
          >
            <span>{option.label}</span>
            {option.isSelected ? (
              option.order === 'desc' ? (
                <ArrowDown className={`w-3 h-3 ${option.activeClassName}`} />
              ) : (
                <ArrowUp className={`w-3 h-3 ${option.activeClassName}`} />
              )
            ) : (
              <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
};

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
  const sizeSortOptions: DesktopSortMenuOption[] = [
    {
      key: 'supply',
      label: 'Sort by Supply',
      isSelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      hoverClassName: 'hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)]',
      onSelect: onSelectSizeSortSupply,
    },
    {
      key: 'borrow',
      label: 'Sort by Borrow',
      isSelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      hoverClassName: 'hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)]',
      onSelect: onSelectSizeSortBorrow,
    },
    {
      key: 'deficitAmount',
      label: 'Sort by Deficit',
      isSelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'text-foreground',
      hoverClassName: 'hover:bg-muted/50',
      onSelect: onSelectSizeSortDeficitAmount,
    },
    {
      key: 'deficitRatio',
      label: 'Sort by Deficit (%)',
      isSelected: sizeSortMode === 'deficitRatio' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'text-foreground',
      hoverClassName: 'hover:bg-muted/50',
      onSelect: onSelectSizeSortDeficitRatio,
    },
  ];

  const supplySortOptions: DesktopSortMenuOption[] = [
    {
      key: 'total',
      label: 'Sort by Total',
      isSelected: supplySortMode === 'total' && activeSortColumn === 'supply',
      order: supplySortOrder,
      activeClassName: 'ds-text-emerald-600',
      hoverClassName: 'hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)]',
      onSelect: onSelectSupplySortTotal,
    },
    {
      key: 'native',
      label: 'Sort by Native',
      isSelected: supplySortMode === 'native' && activeSortColumn === 'supply',
      order: supplySortOrder,
      activeClassName: 'ds-text-emerald-600',
      hoverClassName: 'hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)]',
      onSelect: onSelectSupplySortNative,
    },
    {
      key: 'incentive',
      label: 'Sort by Incentive',
      isSelected: supplySortMode === 'incentive' && activeSortColumn === 'supply',
      order: supplySortOrder,
      activeClassName: 'ds-text-emerald-600',
      hoverClassName: 'hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)]',
      onSelect: onSelectSupplySortIncentive,
    },
  ];

  const borrowSortOptions: DesktopSortMenuOption[] = [
    {
      key: 'total',
      label: 'Sort by Total',
      isSelected: borrowSortMode === 'total' && activeSortColumn === 'borrow',
      order: borrowSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      hoverClassName: 'hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)]',
      onSelect: onSelectBorrowSortTotal,
    },
    {
      key: 'native',
      label: 'Sort by Native',
      isSelected: borrowSortMode === 'native' && activeSortColumn === 'borrow',
      order: borrowSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      hoverClassName: 'hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)]',
      onSelect: onSelectBorrowSortNative,
    },
    {
      key: 'incentive',
      label: 'Sort by Incentive',
      isSelected: borrowSortMode === 'incentive' && activeSortColumn === 'borrow',
      order: borrowSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      hoverClassName: 'hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)]',
      onSelect: onSelectBorrowSortIncentive,
    },
  ];

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
                <DesktopSortMenuPortal
                  open={showSizeSortMenu}
                  menuPos={sizeMenuPos}
                  onClose={onCloseSizeMenu}
                  options={sizeSortOptions}
                  minWidth={160}
                />
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
                <DesktopSortMenuPortal
                  open={showSupplySortMenu}
                  menuPos={supplyMenuPos}
                  onClose={onCloseSupplyMenu}
                  options={supplySortOptions}
                />
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
                <DesktopSortMenuPortal
                  open={showBorrowSortMenu}
                  menuPos={borrowMenuPos}
                  onClose={onCloseBorrowMenu}
                  options={borrowSortOptions}
                />
              </div>
            </div>
          </div>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
