import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';

export type MobileSortMenuKey = 'size' | 'util' | 'supply' | 'borrow' | 'extra';

export type MobileSortOrder = 'asc' | 'desc';

export interface MobileSortOption {
  key: string;
  label: string;
  isSelected: boolean;
  order: MobileSortOrder;
  activeClassName: string;
  onSelect: () => void;
}

const MobileSortMenu = ({
  open,
  onClose,
  options,
  align = 'start',
  minWidthClassName = 'min-w-[6.25rem]',
}: {
  open: boolean;
  onClose: () => void;
  options: MobileSortOption[];
  align?: 'start' | 'end';
  minWidthClassName?: string;
}) => {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className={`absolute ${align === 'start' ? 'left-0' : 'right-0'} top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-0.5 z-20 w-max ${minWidthClassName} max-w-[min(18rem,calc(100vw-1.5rem))]`}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={option.onSelect}
            className={`w-full px-2 py-1.5 text-left ds-text-13 transition-colors flex items-center justify-between gap-1.5 ${
              option.isSelected
                ? `${option.activeClassName} font-bold bg-card/60`
                : 'text-muted-foreground'
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
    </>
  );
};

interface ReservesTableMobileSortBarProps {
  activeSortColumn: string | null;
  sizeSortAccentClass: string;
  utilSortAccentClass: string;
  mobileExtraSortActive: boolean;
  mobileExtraSortChipLabel: string;
  showSizeSortMenu: boolean;
  showUtilSortMenu: boolean;
  showSupplySortMenu: boolean;
  showBorrowSortMenu: boolean;
  showExtraSortMenu: boolean;
  sizeSortOptions: MobileSortOption[];
  utilSortOptions: MobileSortOption[];
  supplySortOptions: MobileSortOption[];
  borrowSortOptions: MobileSortOption[];
  extraSortOptions: MobileSortOption[];
  onToggleMenu: (menu: MobileSortMenuKey) => void;
  onCloseMenus: () => void;
}

export default function ReservesTableMobileSortBar({
  activeSortColumn,
  sizeSortAccentClass,
  utilSortAccentClass,
  mobileExtraSortActive,
  mobileExtraSortChipLabel,
  showSizeSortMenu,
  showUtilSortMenu,
  showSupplySortMenu,
  showBorrowSortMenu,
  showExtraSortMenu,
  sizeSortOptions,
  utilSortOptions,
  supplySortOptions,
  borrowSortOptions,
  extraSortOptions,
  onToggleMenu,
  onCloseMenus,
}: ReservesTableMobileSortBarProps) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-[var(--ds-space-1-5)] px-[var(--ds-space-1)]">
      <div className="relative overflow-visible">
        <button
          type="button"
          onClick={() => onToggleMenu('size')}
          className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
            activeSortColumn === 'size'
              ? `bg-card/60 border-border/70 ${sizeSortAccentClass} font-semibold`
              : 'bg-card border-border text-muted-foreground font-medium'
          }`}
        >
          <span>Size</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <MobileSortMenu
          open={showSizeSortMenu}
          onClose={onCloseMenus}
          options={sizeSortOptions}
        />
      </div>

      <div className="relative overflow-visible">
        <button
          type="button"
          onClick={() => onToggleMenu('util')}
          className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
            activeSortColumn === 'util'
              ? `bg-card/60 border-border/70 ${utilSortAccentClass} font-semibold`
              : 'bg-card border-border text-muted-foreground font-medium'
          }`}
        >
          <span>Util</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <MobileSortMenu
          open={showUtilSortMenu}
          onClose={onCloseMenus}
          options={utilSortOptions}
        />
      </div>

      <div className="relative overflow-visible">
        <button
          type="button"
          onClick={() => onToggleMenu('supply')}
          className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
            activeSortColumn === 'supply'
              ? 'bg-card/60 border-border/70 ds-text-emerald-700 font-semibold'
              : 'bg-card border-border text-muted-foreground font-medium'
          }`}
        >
          <span>Supply</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <MobileSortMenu
          open={showSupplySortMenu}
          onClose={onCloseMenus}
          options={supplySortOptions}
        />
      </div>

      <div className="relative overflow-visible">
        <button
          type="button"
          onClick={() => onToggleMenu('borrow')}
          className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
            activeSortColumn === 'borrow'
              ? 'bg-card/60 border-border/70 ds-text-brand-cyan font-semibold'
              : 'bg-card border-border text-muted-foreground font-medium'
          }`}
        >
          <span>Borrow</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <MobileSortMenu
          open={showBorrowSortMenu}
          onClose={onCloseMenus}
          options={borrowSortOptions}
          align="end"
        />
      </div>

      <div className="relative overflow-visible">
        <button
          type="button"
          onClick={() => onToggleMenu('extra')}
          className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
            activeSortColumn === 'spread'
              ? 'bg-card/60 border-border/70 ds-text-purple-700 font-semibold'
              : mobileExtraSortActive
                ? 'bg-card/60 border-border/70 text-foreground font-semibold'
                : 'bg-card border-border text-muted-foreground font-medium'
          }`}
          aria-label="Sort by spread, token, market, or price"
        >
          <span className="truncate">{mobileExtraSortChipLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </button>
        <MobileSortMenu
          open={showExtraSortMenu}
          onClose={onCloseMenus}
          options={extraSortOptions}
          align="end"
          minWidthClassName="min-w-[7.5rem]"
        />
      </div>
    </div>
  );
}
