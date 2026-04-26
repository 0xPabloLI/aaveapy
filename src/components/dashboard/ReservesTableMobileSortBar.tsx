import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';

export type MobileSortMenuKey = 'size' | 'supply' | 'borrow' | 'extra';

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
  minWidthClassName = 'min-w-[6.25rem]',
}: {
  open: boolean;
  onClose: () => void;
  options: MobileSortOption[];
  minWidthClassName?: string;
}) => {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className={`absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-0.5 z-20 w-max ${minWidthClassName} max-w-[min(18rem,calc(100vw-1.5rem))]`}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={option.onSelect}
            className={`w-full px-2 py-1.5 text-left ds-text-13 transition-colors flex items-center justify-start gap-1.5 ${
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
  reservesCount: number;
  activeSortColumn: string | null;
  sizeSortAccentClass: string;
  mobileExtraSortActive: boolean;
  mobileExtraSortChipLabel: string;
  showSizeSortMenu: boolean;
  showSupplySortMenu: boolean;
  showBorrowSortMenu: boolean;
  showExtraSortMenu: boolean;
  sizeSortOptions: MobileSortOption[];
  supplySortOptions: MobileSortOption[];
  borrowSortOptions: MobileSortOption[];
  extraSortOptions: MobileSortOption[];
  onToggleMenu: (menu: MobileSortMenuKey) => void;
  onCloseMenus: () => void;
}

export default function ReservesTableMobileSortBar({
  reservesCount,
  activeSortColumn,
  sizeSortAccentClass,
  mobileExtraSortActive,
  mobileExtraSortChipLabel,
  showSizeSortMenu,
  showSupplySortMenu,
  showBorrowSortMenu,
  showExtraSortMenu,
  sizeSortOptions,
  supplySortOptions,
  borrowSortOptions,
  extraSortOptions,
  onToggleMenu,
  onCloseMenus,
}: ReservesTableMobileSortBarProps) {
  return (
    <div className="flex justify-between items-center px-[var(--ds-space-1)]">
      <h3 className="ds-text-14 font-bold text-foreground">{reservesCount} Reserves</h3>
      <div className="flex items-center gap-[var(--ds-space-1-5)]">
        <div className="relative">
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

        <div className="relative">
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

        <div className="relative">
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
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => onToggleMenu('extra')}
            className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors max-w-[7.5rem] ${
              activeSortColumn === 'spread'
                ? 'bg-card/60 border-border/70 ds-text-purple-700 font-semibold'
                : mobileExtraSortActive
                  ? 'bg-card/60 border-border/70 text-foreground font-semibold'
                  : 'bg-card border-border text-muted-foreground font-medium'
            }`}
            aria-label="Sort by spread, token, market, price, or utilization"
          >
            <span className="truncate">{mobileExtraSortChipLabel}</span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
          <MobileSortMenu
            open={showExtraSortMenu}
            onClose={onCloseMenus}
            options={extraSortOptions}
            minWidthClassName="min-w-[7.5rem]"
          />
        </div>
      </div>
    </div>
  );
}
