import { useState } from 'react';
import { ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SortField, SortOrder } from '@/types/aave';

type SortSubField = 'total' | 'native' | 'incentive';

interface SortDropdownProps {
  label: string;
  baseField: 'totalSupplyApy' | 'totalBorrowApy';
  currentSortField: SortField;
  currentSortOrder: SortOrder;
  onSort: (field: SortField) => void;
  colorClass: string;
}

const sortOptions: { value: SortSubField; label: string; colorClass: string }[] = [
  { value: 'total', label: 'Total', colorClass: 'ds-text-emerald-500 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)]' },
  { value: 'native', label: 'Native', colorClass: 'ds-text-blue-500 ds-bg-blue-500-10 hover:bg-[rgb(var(--ds-blue-500-rgb)/0.2)]' },
  { value: 'incentive', label: 'Incentive', colorClass: 'ds-text-amber-500 ds-bg-amber-500-10 hover:bg-[rgb(var(--ds-amber-500-rgb)/0.2)]' },
];

const SortDropdown = ({ 
  label, 
  baseField, 
  currentSortField, 
  currentSortOrder, 
  onSort,
  colorClass 
}: SortDropdownProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedSubField, setSelectedSubField] = useState<SortSubField>('total');

  const isActive = currentSortField === baseField;

  const handleSubFieldSelect = (subField: SortSubField) => {
    setSelectedSubField(subField);
    setShowMenu(false);
    // For now, we only have total field - native/incentive would need API changes
    onSort(baseField);
  };

  const toggleSortOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSort(baseField);
  };

  const currentOption = sortOptions.find(o => o.value === selectedSubField) || sortOptions[0];

  return (
    <div className="flex items-center justify-end gap-[var(--ds-space-3)]">
      {/* Sort field selector */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`ds-chip gap-[var(--ds-space-1-5)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded transition-colors ${
            isActive ? currentOption.colorClass : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          }`}
          title="Select sort field"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>{label} ({currentOption.label})</span>
        </button>
        
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-popover border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[140px]">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSubFieldSelect(option.value)}
                  className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-11 font-medium transition-colors ${
                    selectedSubField === option.value 
                      ? option.colorClass 
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  Sort by {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Sort direction toggle - separate from dropdown */}
      <button
        onClick={toggleSortOrder}
        className={`ds-icon-button transition-colors ${
          isActive 
            ? 'bg-accent text-foreground' 
            : 'hover:bg-accent text-muted-foreground hover:text-foreground'
        }`}
        title="Toggle sort direction"
      >
        {currentSortOrder === 'desc' ? (
          <ArrowDown className={`w-4 h-4 ${isActive ? colorClass : ''}`} />
        ) : (
          <ArrowUp className={`w-4 h-4 ${isActive ? colorClass : ''}`} />
        )}
      </button>
    </div>
  );
};

export default SortDropdown;
