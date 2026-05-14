import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { MobileSortMenuKey } from '@/components/dashboard/ReservesTableMobileSortBar';

export type SortMode = 'total' | 'native' | 'incentive';

export type SortableColumn =
  | 'token'
  | 'price'
  | 'market'
  | 'size'
  | 'util'
  | 'supply'
  | 'borrow'
  | 'spread';

export type SizeSortMode =
  | 'supply'
  | 'borrow'
  | 'borrowAvailability'
  | 'supplyAvailability'
  | 'deficitRatio'
  | 'deficitAmount';

export type UtilSortMode = 'util' | 'liquidity';

export type SortOrder = 'asc' | 'desc';

export type MenuPosition = { top: number; left: number };

interface UseReservesTableSortOptions {
  /**
   * Called before mutating the active column / sort order via the high-level
   * `handleSort*` and `toggle*SortOrder` helpers. Wired to
   * `collapseExpandedOnSort` in the component so changing sort closes any
   * currently expanded reserve row.
   */
  collapseExpanded: () => void;
}

export interface UseReservesTableSortResult {
  // Active column + per-column orders / modes
  activeSortColumn: SortableColumn | null;
  setActiveSortColumn: Dispatch<SetStateAction<SortableColumn | null>>;
  tokenSortOrder: SortOrder;
  setTokenSortOrder: Dispatch<SetStateAction<SortOrder>>;
  marketSortOrder: SortOrder;
  setMarketSortOrder: Dispatch<SetStateAction<SortOrder>>;
  priceSortOrder: SortOrder;
  setPriceSortOrder: Dispatch<SetStateAction<SortOrder>>;
  sizeSortMode: SizeSortMode;
  setSizeSortMode: Dispatch<SetStateAction<SizeSortMode>>;
  sizeSortOrder: SortOrder;
  setSizeSortOrder: Dispatch<SetStateAction<SortOrder>>;
  utilSortOrder: SortOrder;
  setUtilSortOrder: Dispatch<SetStateAction<SortOrder>>;
  utilSortMode: UtilSortMode;
  setUtilSortMode: Dispatch<SetStateAction<UtilSortMode>>;
  supplySortMode: SortMode;
  setSupplySortMode: Dispatch<SetStateAction<SortMode>>;
  supplySortOrder: SortOrder;
  setSupplySortOrder: Dispatch<SetStateAction<SortOrder>>;
  borrowSortMode: SortMode;
  setBorrowSortMode: Dispatch<SetStateAction<SortMode>>;
  borrowSortOrder: SortOrder;
  setBorrowSortOrder: Dispatch<SetStateAction<SortOrder>>;
  spreadSortOrder: SortOrder;
  setSpreadSortOrder: Dispatch<SetStateAction<SortOrder>>;

  // Mobile sort menu visibility + button refs + computed positions
  showUtilSortMenu: boolean;
  setShowUtilSortMenu: Dispatch<SetStateAction<boolean>>;
  utilSortButtonRef: React.RefObject<HTMLButtonElement | null>;
  utilMenuPos: MenuPosition | null;

  showSizeSortMenu: boolean;
  setShowSizeSortMenu: Dispatch<SetStateAction<boolean>>;
  sizeSortButtonRef: React.RefObject<HTMLButtonElement | null>;
  sizeMenuPos: MenuPosition | null;

  showSupplySortMenu: boolean;
  setShowSupplySortMenu: Dispatch<SetStateAction<boolean>>;
  supplySortButtonRef: React.RefObject<HTMLButtonElement | null>;
  supplyMenuPos: MenuPosition | null;

  showBorrowSortMenu: boolean;
  setShowBorrowSortMenu: Dispatch<SetStateAction<boolean>>;
  borrowSortButtonRef: React.RefObject<HTMLButtonElement | null>;
  borrowMenuPos: MenuPosition | null;

  showExtraSortMenu: boolean;
  setShowExtraSortMenu: Dispatch<SetStateAction<boolean>>;

  // Header-level handlers (each runs `collapseExpanded` first)
  handleSortToken: () => void;
  handleSortMarket: () => void;
  handleSortPrice: () => void;
  handleSortSize: () => void;
  handleSortUtil: () => void;
  toggleSupplySortOrder: () => void;
  toggleBorrowSortOrder: () => void;
  toggleSpreadSortOrder: () => void;

  // Mobile sort menu controls
  closeAllMobileSortMenus: (except?: MobileSortMenuKey | null) => void;
  toggleMobileSortMenu: (menu: MobileSortMenuKey) => void;
}

/**
 * Owns every column-sort related piece of state on the reserves table:
 * which column is active, per-column order/mode toggles, and the mobile
 * sort menu visibility + dropdown anchor positions. Extracted from the
 * monolithic `ReservesTable` component to keep the host shell focused on
 * composition + JSX.
 *
 * Behaviour preserved verbatim from the original inline state — see the
 * git history of `src/components/dashboard/ReservesTable.tsx` prior to the
 * extraction for context.
 */
export function useReservesTableSort(
  { collapseExpanded }: UseReservesTableSortOptions,
): UseReservesTableSortResult {
  // Active column + per-column orders / modes
  const [activeSortColumn, setActiveSortColumn] = useState<SortableColumn | null>('supply');
  const [tokenSortOrder, setTokenSortOrder] = useState<SortOrder>('asc');
  const [marketSortOrder, setMarketSortOrder] = useState<SortOrder>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<SortOrder>('desc');
  const [sizeSortMode, setSizeSortMode] = useState<SizeSortMode>('supply');
  const [sizeSortOrder, setSizeSortOrder] = useState<SortOrder>('desc');
  const [utilSortOrder, setUtilSortOrder] = useState<SortOrder>('desc');
  const [utilSortMode, setUtilSortMode] = useState<UtilSortMode>('util');
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('incentive');
  const [supplySortOrder, setSupplySortOrder] = useState<SortOrder>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<SortOrder>('desc');
  const [spreadSortOrder, setSpreadSortOrder] = useState<SortOrder>('desc');

  // Mobile sort menu visibility + refs + positions
  const [showUtilSortMenu, setShowUtilSortMenu] = useState(false);
  const utilSortButtonRef = useRef<HTMLButtonElement>(null);
  const [utilMenuPos, setUtilMenuPos] = useState<MenuPosition | null>(null);

  const [showSizeSortMenu, setShowSizeSortMenu] = useState(false);
  const sizeSortButtonRef = useRef<HTMLButtonElement>(null);
  const [sizeMenuPos, setSizeMenuPos] = useState<MenuPosition | null>(null);

  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const supplySortButtonRef = useRef<HTMLButtonElement>(null);
  const [supplyMenuPos, setSupplyMenuPos] = useState<MenuPosition | null>(null);

  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
  const borrowSortButtonRef = useRef<HTMLButtonElement>(null);
  const [borrowMenuPos, setBorrowMenuPos] = useState<MenuPosition | null>(null);

  const [showExtraSortMenu, setShowExtraSortMenu] = useState(false);

  // Recompute dropdown positions whenever a menu opens. Mirrors the four
  // identical useEffects that previously lived in the host component.
  useEffect(() => {
    if (showBorrowSortMenu && borrowSortButtonRef.current) {
      const rect = borrowSortButtonRef.current.getBoundingClientRect();
      setBorrowMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showBorrowSortMenu]);

  useEffect(() => {
    if (showSupplySortMenu && supplySortButtonRef.current) {
      const rect = supplySortButtonRef.current.getBoundingClientRect();
      setSupplyMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showSupplySortMenu]);

  useEffect(() => {
    if (showSizeSortMenu && sizeSortButtonRef.current) {
      const rect = sizeSortButtonRef.current.getBoundingClientRect();
      setSizeMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [showSizeSortMenu]);

  useEffect(() => {
    if (showUtilSortMenu && utilSortButtonRef.current) {
      const rect = utilSortButtonRef.current.getBoundingClientRect();
      setUtilMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
    }
  }, [showUtilSortMenu]);

  // Header-level handlers — each closes any expanded row first.
  const handleSortToken = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('token');
    setTokenSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  }, [collapseExpanded]);

  const handleSortMarket = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('market');
    setMarketSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  }, [collapseExpanded]);

  const handleSortPrice = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('price');
    setPriceSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  }, [collapseExpanded]);

  const handleSortSize = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('size');
    setSizeSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  }, [collapseExpanded]);

  const handleSortUtil = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('util');
    setUtilSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    setShowUtilSortMenu(false);
  }, [collapseExpanded]);

  const toggleSupplySortOrder = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('supply');
    setSupplySortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  }, [collapseExpanded]);

  const toggleBorrowSortOrder = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('borrow');
    setBorrowSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  }, [collapseExpanded]);

  const toggleSpreadSortOrder = useCallback(() => {
    collapseExpanded();
    setActiveSortColumn('spread');
    setSpreadSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  }, [collapseExpanded]);

  // Mobile sort menu visibility helpers.
  const closeAllMobileSortMenus = useCallback((except: MobileSortMenuKey | null = null) => {
    if (except !== 'size') setShowSizeSortMenu(false);
    if (except !== 'supply') setShowSupplySortMenu(false);
    if (except !== 'borrow') setShowBorrowSortMenu(false);
    if (except !== 'extra') setShowExtraSortMenu(false);
    setShowUtilSortMenu(false);
  }, []);

  const toggleMobileSortMenu = useCallback((menu: MobileSortMenuKey) => {
    closeAllMobileSortMenus(menu);
    switch (menu) {
      case 'size':
        setShowSizeSortMenu((prev) => !prev);
        break;
      case 'util':
        setShowUtilSortMenu((prev) => !prev);
        break;
      case 'supply':
        setShowSupplySortMenu((prev) => !prev);
        break;
      case 'borrow':
        setShowBorrowSortMenu((prev) => !prev);
        break;
      case 'extra':
        setShowExtraSortMenu((prev) => !prev);
        break;
    }
  }, [closeAllMobileSortMenus]);

  return {
    activeSortColumn,
    setActiveSortColumn,
    tokenSortOrder,
    setTokenSortOrder,
    marketSortOrder,
    setMarketSortOrder,
    priceSortOrder,
    setPriceSortOrder,
    sizeSortMode,
    setSizeSortMode,
    sizeSortOrder,
    setSizeSortOrder,
    utilSortOrder,
    setUtilSortOrder,
    utilSortMode,
    setUtilSortMode,
    supplySortMode,
    setSupplySortMode,
    supplySortOrder,
    setSupplySortOrder,
    borrowSortMode,
    setBorrowSortMode,
    borrowSortOrder,
    setBorrowSortOrder,
    spreadSortOrder,
    setSpreadSortOrder,

    showUtilSortMenu,
    setShowUtilSortMenu,
    utilSortButtonRef,
    utilMenuPos,
    showSizeSortMenu,
    setShowSizeSortMenu,
    sizeSortButtonRef,
    sizeMenuPos,
    showSupplySortMenu,
    setShowSupplySortMenu,
    supplySortButtonRef,
    supplyMenuPos,
    showBorrowSortMenu,
    setShowBorrowSortMenu,
    borrowSortButtonRef,
    borrowMenuPos,
    showExtraSortMenu,
    setShowExtraSortMenu,

    handleSortToken,
    handleSortMarket,
    handleSortPrice,
    handleSortSize,
    handleSortUtil,
    toggleSupplySortOrder,
    toggleBorrowSortOrder,
    toggleSpreadSortOrder,

    closeAllMobileSortMenus,
    toggleMobileSortMenu,
  };
}
