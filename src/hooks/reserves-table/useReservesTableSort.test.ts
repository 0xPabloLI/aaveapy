// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useReservesTableSort, toggleSortOrder, toggleSortOrderAscFirst } from './useReservesTableSort';

const collapseExpandedNoop = () => {};

describe('useReservesTableSort', () => {
  describe('toggleSortOrder / toggleSortOrderAscFirst pure functions', () => {
    it('toggleSortOrder flips desc↔asc', () => {
      expect(toggleSortOrder('desc')).toBe('asc');
      expect(toggleSortOrder('asc')).toBe('desc');
    });

    it('toggleSortOrderAscFirst flips asc↔desc', () => {
      expect(toggleSortOrderAscFirst('asc')).toBe('desc');
      expect(toggleSortOrderAscFirst('desc')).toBe('asc');
    });
  });

  describe('initial defaults', () => {
    it('starts with `supply` as the active column and per-column defaults matching the legacy inline state', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.activeSortColumn).toBe('supply');
      expect(result.current.tokenSortOrder).toBe('asc');
      expect(result.current.marketSortOrder).toBe('asc');
      expect(result.current.priceSortOrder).toBe('desc');
      expect(result.current.sizeSortMode).toBe('supply');
      expect(result.current.sizeSortOrder).toBe('desc');
      expect(result.current.utilSortOrder).toBe('desc');
      expect(result.current.utilSortMode).toBe('util');
      expect(result.current.supplySortMode).toBe('incentive');
      expect(result.current.supplySortOrder).toBe('desc');
      expect(result.current.borrowSortMode).toBe('total');
      expect(result.current.borrowSortOrder).toBe('desc');
      expect(result.current.spreadSortOrder).toBe('desc');
    });

    it('starts with every mobile sort menu closed and all menu positions null', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.showUtilSortMenu).toBe(false);
      expect(result.current.showSizeSortMenu).toBe(false);
      expect(result.current.showSupplySortMenu).toBe(false);
      expect(result.current.showBorrowSortMenu).toBe(false);
      expect(result.current.showExtraSortMenu).toBe(false);
      expect(result.current.utilMenuPos).toBeNull();
      expect(result.current.sizeMenuPos).toBeNull();
      expect(result.current.supplyMenuPos).toBeNull();
      expect(result.current.borrowMenuPos).toBeNull();
    });
  });

  describe('column-sort handlers', () => {
    it('handleSortToken collapses any expansion, switches column, and toggles asc⇄desc', () => {
      const collapseExpanded = vi.fn();
      const { result } = renderHook(() => useReservesTableSort({ collapseExpanded }));

      act(() => result.current.handleSortToken());
      expect(collapseExpanded).toHaveBeenCalledTimes(1);
      expect(result.current.activeSortColumn).toBe('token');
      expect(result.current.tokenSortOrder).toBe('desc');

      act(() => result.current.handleSortToken());
      expect(collapseExpanded).toHaveBeenCalledTimes(2);
      expect(result.current.tokenSortOrder).toBe('asc');
    });

    it('handleSortMarket toggles the market order', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.handleSortMarket());
      expect(result.current.activeSortColumn).toBe('market');
      expect(result.current.marketSortOrder).toBe('desc');

      act(() => result.current.handleSortMarket());
      expect(result.current.marketSortOrder).toBe('asc');
    });

    it('handleSortPrice toggles desc⇄asc starting from desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.handleSortPrice());
      expect(result.current.activeSortColumn).toBe('price');
      expect(result.current.priceSortOrder).toBe('asc');

      act(() => result.current.handleSortPrice());
      expect(result.current.priceSortOrder).toBe('desc');
    });

    it('handleSortSize toggles desc⇄asc starting from desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.handleSortSize());
      expect(result.current.activeSortColumn).toBe('size');
      expect(result.current.sizeSortOrder).toBe('asc');

      act(() => result.current.handleSortSize());
      expect(result.current.sizeSortOrder).toBe('desc');
    });

    it('handleSortUtil also force-closes the util sort menu', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.setShowUtilSortMenu(true));
      expect(result.current.showUtilSortMenu).toBe(true);

      act(() => result.current.handleSortUtil());
      expect(result.current.activeSortColumn).toBe('util');
      expect(result.current.utilSortOrder).toBe('asc');
      expect(result.current.showUtilSortMenu).toBe(false);
    });

    it('toggleSupplySortOrder / toggleBorrowSortOrder / toggleSpreadSortOrder set the active column and flip order', () => {
      const collapseExpanded = vi.fn();
      const { result } = renderHook(() => useReservesTableSort({ collapseExpanded }));

      act(() => result.current.toggleSupplySortOrder());
      expect(result.current.activeSortColumn).toBe('supply');
      expect(result.current.supplySortOrder).toBe('asc');

      act(() => result.current.toggleBorrowSortOrder());
      expect(result.current.activeSortColumn).toBe('borrow');
      expect(result.current.borrowSortOrder).toBe('asc');

      act(() => result.current.toggleSpreadSortOrder());
      expect(result.current.activeSortColumn).toBe('spread');
      expect(result.current.spreadSortOrder).toBe('asc');

      expect(collapseExpanded).toHaveBeenCalledTimes(3);
    });
  });

  describe('bidirectional sort-order toggle (regression: asc→desc must work)', () => {
    it('toggleSupplySortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.supplySortOrder).toBe('desc');
      act(() => result.current.toggleSupplySortOrder());
      expect(result.current.supplySortOrder).toBe('asc');
      act(() => result.current.toggleSupplySortOrder());
      expect(result.current.supplySortOrder).toBe('desc');
    });

    it('toggleBorrowSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.borrowSortOrder).toBe('desc');
      act(() => result.current.toggleBorrowSortOrder());
      expect(result.current.borrowSortOrder).toBe('asc');
      act(() => result.current.toggleBorrowSortOrder());
      expect(result.current.borrowSortOrder).toBe('desc');
    });

    it('toggleSpreadSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.spreadSortOrder).toBe('desc');
      act(() => result.current.toggleSpreadSortOrder());
      expect(result.current.spreadSortOrder).toBe('asc');
      act(() => result.current.toggleSpreadSortOrder());
      expect(result.current.spreadSortOrder).toBe('desc');
    });

    it('setSizeSortOrder with toggleSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.sizeSortOrder).toBe('desc');
      act(() => result.current.setSizeSortOrder(toggleSortOrder));
      expect(result.current.sizeSortOrder).toBe('asc');
      act(() => result.current.setSizeSortOrder(toggleSortOrder));
      expect(result.current.sizeSortOrder).toBe('desc');
    });

    it('setUtilSortOrder with toggleSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.utilSortOrder).toBe('desc');
      act(() => result.current.setUtilSortOrder(toggleSortOrder));
      expect(result.current.utilSortOrder).toBe('asc');
      act(() => result.current.setUtilSortOrder(toggleSortOrder));
      expect(result.current.utilSortOrder).toBe('desc');
    });

    it('setSupplySortOrder with toggleSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.setSupplySortOrder(toggleSortOrder));
      expect(result.current.supplySortOrder).toBe('asc');
      act(() => result.current.setSupplySortOrder(toggleSortOrder));
      expect(result.current.supplySortOrder).toBe('desc');
    });

    it('setBorrowSortOrder with toggleSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.setBorrowSortOrder(toggleSortOrder));
      expect(result.current.borrowSortOrder).toBe('asc');
      act(() => result.current.setBorrowSortOrder(toggleSortOrder));
      expect(result.current.borrowSortOrder).toBe('desc');
    });

    it('setTokenSortOrder with toggleSortOrderAscFirst toggles asc→desc→asc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.tokenSortOrder).toBe('asc');
      act(() => result.current.setTokenSortOrder(toggleSortOrderAscFirst));
      expect(result.current.tokenSortOrder).toBe('desc');
      act(() => result.current.setTokenSortOrder(toggleSortOrderAscFirst));
      expect(result.current.tokenSortOrder).toBe('asc');
    });

    it('setMarketSortOrder with toggleSortOrderAscFirst toggles asc→desc→asc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.marketSortOrder).toBe('asc');
      act(() => result.current.setMarketSortOrder(toggleSortOrderAscFirst));
      expect(result.current.marketSortOrder).toBe('desc');
      act(() => result.current.setMarketSortOrder(toggleSortOrderAscFirst));
      expect(result.current.marketSortOrder).toBe('asc');
    });

    it('setPriceSortOrder with toggleSortOrder toggles desc→asc→desc', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      expect(result.current.priceSortOrder).toBe('desc');
      act(() => result.current.setPriceSortOrder(toggleSortOrder));
      expect(result.current.priceSortOrder).toBe('asc');
      act(() => result.current.setPriceSortOrder(toggleSortOrder));
      expect(result.current.priceSortOrder).toBe('desc');
    });
  });

  describe('mobile sort menu controls', () => {
    it('toggleMobileSortMenu opens the requested menu and closes others', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.toggleMobileSortMenu('size'));
      expect(result.current.showSizeSortMenu).toBe(true);
      expect(result.current.showSupplySortMenu).toBe(false);
      expect(result.current.showBorrowSortMenu).toBe(false);
      expect(result.current.showExtraSortMenu).toBe(false);
      expect(result.current.showUtilSortMenu).toBe(false);

      act(() => result.current.toggleMobileSortMenu('borrow'));
      expect(result.current.showSizeSortMenu).toBe(false);
      expect(result.current.showBorrowSortMenu).toBe(true);
    });

    it('toggleMobileSortMenu called twice on the same key closes that menu', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => result.current.toggleMobileSortMenu('supply'));
      expect(result.current.showSupplySortMenu).toBe(true);

      act(() => result.current.toggleMobileSortMenu('supply'));
      expect(result.current.showSupplySortMenu).toBe(false);
    });

    it('closeAllMobileSortMenus closes every menu when called with no exception', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => {
        result.current.setShowSizeSortMenu(true);
        result.current.setShowSupplySortMenu(true);
        result.current.setShowBorrowSortMenu(true);
        result.current.setShowExtraSortMenu(true);
        result.current.setShowUtilSortMenu(true);
      });

      act(() => result.current.closeAllMobileSortMenus());
      expect(result.current.showSizeSortMenu).toBe(false);
      expect(result.current.showSupplySortMenu).toBe(false);
      expect(result.current.showBorrowSortMenu).toBe(false);
      expect(result.current.showExtraSortMenu).toBe(false);
      expect(result.current.showUtilSortMenu).toBe(false);
    });

    it('closeAllMobileSortMenus(except) preserves the named menu but always closes util', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      act(() => {
        result.current.setShowSizeSortMenu(true);
        result.current.setShowSupplySortMenu(true);
        result.current.setShowUtilSortMenu(true);
      });

      act(() => result.current.closeAllMobileSortMenus('size'));
      expect(result.current.showSizeSortMenu).toBe(true);
      expect(result.current.showSupplySortMenu).toBe(false);
      expect(result.current.showUtilSortMenu).toBe(false);
    });
  });

  describe('menu position recompute effects', () => {
    it('recomputes utilMenuPos from utilSortButtonRef.getBoundingClientRect when the menu opens', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      const fakeButton = {
        getBoundingClientRect: () => ({ bottom: 100, right: 220 }),
      } as unknown as HTMLButtonElement;
      // Pin the ref before opening the menu so the effect sees a non-null current.
      (result.current.utilSortButtonRef as { current: HTMLButtonElement | null }).current = fakeButton;

      act(() => result.current.setShowUtilSortMenu(true));
      expect(result.current.utilMenuPos).toEqual({ top: 104, left: 40 });
    });

    it('recomputes supplyMenuPos using a 140px left offset', () => {
      const { result } = renderHook(() =>
        useReservesTableSort({ collapseExpanded: collapseExpandedNoop }),
      );

      const fakeButton = {
        getBoundingClientRect: () => ({ bottom: 50, right: 200 }),
      } as unknown as HTMLButtonElement;
      (result.current.supplySortButtonRef as { current: HTMLButtonElement | null }).current = fakeButton;

      act(() => result.current.setShowSupplySortMenu(true));
      expect(result.current.supplyMenuPos).toEqual({ top: 54, left: 60 });
    });
  });
});
