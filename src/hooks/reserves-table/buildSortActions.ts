import type { SortOrder } from '@/lib/sorters';
import type { SizeSortMode, SortableColumn, UtilSortMode } from '@/lib/reservesSorter';
import { selectSortOption, toggleSortOrder } from './useReservesTableSort';

export type SortAction = {
  onSort: () => void;
  isActive: boolean;
  sortOrder: SortOrder;
};

export type SortKey = SizeSortMode | UtilSortMode;

export type SortActions = Record<SortKey, SortAction>;

type SortColumn = 'size' | 'util';

const SIZE_SORT_KEYS = [
  'supply',
  'borrow',
  'borrowAvailability',
  'supplyAvailability',
  'deficitRatio',
  'deficitAmount',
  'supplyCapPct',
  'borrowCapPct',
  'supplyCapValue',
  'borrowCapValue',
  'availableLiquidity',
] as const satisfies readonly SizeSortMode[];

const UTIL_SORT_KEYS = ['util', 'liquidity', 'optimal'] as const satisfies readonly UtilSortMode[];

export interface BuildSortActionsInput {
  activeSortColumn: SortableColumn | null;
  sizeSortMode: SizeSortMode;
  sizeSortOrder: SortOrder;
  utilSortMode: UtilSortMode;
  utilSortOrder: SortOrder;
  setSizeSortMode: React.Dispatch<React.SetStateAction<SizeSortMode>>;
  setSizeSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
  setUtilSortMode: React.Dispatch<React.SetStateAction<UtilSortMode>>;
  setUtilSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
  setActiveSortColumn: React.Dispatch<React.SetStateAction<SortableColumn | null>>;
  collapseExpandedOnSort: () => void;
}

function assertCompleteSortActions(actions: Partial<SortActions>): asserts actions is SortActions {
  const missing = ([] as SortKey[]).concat(SIZE_SORT_KEYS, UTIL_SORT_KEYS).filter((k) => actions[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`buildSortActions: missing keys: ${missing.join(', ')}`);
  }
}

export function buildSortActions(input: BuildSortActionsInput): SortActions {
  const actions: Partial<SortActions> = {};

  for (const key of SIZE_SORT_KEYS) {
    const column: SortColumn = 'size';
    actions[key] = {
      onSort: () => {
        input.collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: input.sizeSortMode === key && input.activeSortColumn === column,
          setSortOrder: input.setSizeSortOrder,
          toggleOrderFn: toggleSortOrder,
          defaultOrder: 'desc',
          setSortMode: input.setSizeSortMode,
          targetMode: key,
          setActiveSortColumn: input.setActiveSortColumn,
          targetColumn: column,
        });
      },
      isActive: input.activeSortColumn === column && input.sizeSortMode === key,
      sortOrder: input.sizeSortOrder,
    };
  }

  for (const key of UTIL_SORT_KEYS) {
    const column: SortColumn = 'util';
    actions[key] = {
      onSort: () => {
        input.collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: input.utilSortMode === key && input.activeSortColumn === column,
          setSortOrder: input.setUtilSortOrder,
          toggleOrderFn: toggleSortOrder,
          defaultOrder: 'desc',
          setSortMode: input.setUtilSortMode,
          targetMode: key,
          setActiveSortColumn: input.setActiveSortColumn,
          targetColumn: column,
        });
      },
      isActive: input.activeSortColumn === column && input.utilSortMode === key,
      sortOrder: input.utilSortOrder,
    };
  }

  assertCompleteSortActions(actions);
  return actions;
}
