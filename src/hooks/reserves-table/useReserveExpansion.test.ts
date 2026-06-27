// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useReserveExpansion } from './useReserveExpansion';

describe('useReserveExpansion', () => {
  describe('default state', () => {
    it('starts with no expanded reserve and a null suppression latch', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      expect(result.current.expandedReserveId).toBeNull();
      expect(result.current.suppressNextToggleReserveIdRef.current).toBeNull();
    });
  });

  describe('handleToggleExpand', () => {
    it('opens a row when collapsed', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => result.current.handleToggleExpand('reserve-A'));
      expect(result.current.expandedReserveId).toBe('reserve-A');
    });

    it('collapses the row when toggled with the same id', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => result.current.handleToggleExpand('reserve-A'));
      act(() => result.current.handleToggleExpand('reserve-A'));
      expect(result.current.expandedReserveId).toBeNull();
    });

    it('switches expansion to a different reserve id', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => result.current.handleToggleExpand('reserve-A'));
      act(() => result.current.handleToggleExpand('reserve-B'));
      expect(result.current.expandedReserveId).toBe('reserve-B');
    });

    it('honours the suppression latch: a tagged toggle is swallowed and the latch resets', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      // Pre-arm the latch then attempt to toggle.
      act(() => {
        result.current.suppressNextToggleReserveIdRef.current = 'reserve-A';
      });
      act(() => result.current.handleToggleExpand('reserve-A'));

      // First toggle ignored, latch cleared.
      expect(result.current.expandedReserveId).toBeNull();
      expect(result.current.suppressNextToggleReserveIdRef.current).toBeNull();

      // Subsequent toggle behaves normally.
      act(() => result.current.handleToggleExpand('reserve-A'));
      expect(result.current.expandedReserveId).toBe('reserve-A');
    });

    it('latch only suppresses an exact id match — other rows still toggle', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => {
        result.current.suppressNextToggleReserveIdRef.current = 'reserve-A';
      });
      act(() => result.current.handleToggleExpand('reserve-B'));
      expect(result.current.expandedReserveId).toBe('reserve-B');
      // Latch for reserve-A still pending.
      expect(result.current.suppressNextToggleReserveIdRef.current).toBe('reserve-A');
    });
  });

  describe('collapseExpanded', () => {
    it('clears the expanded id', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => result.current.setExpandedReserveId('reserve-A'));
      expect(result.current.expandedReserveId).toBe('reserve-A');

      act(() => result.current.collapseExpanded());
      expect(result.current.expandedReserveId).toBeNull();
    });

    it('keeps stable identity across renders so consumers can use it as a useCallback dep', () => {
      const { result, rerender } = renderHook(() => useReserveExpansion({ isMobile: false }));
      const first = result.current.collapseExpanded;
      rerender();
      expect(result.current.collapseExpanded).toBe(first);
    });
  });

  describe('cleanup effects', () => {
    it('clears the suppression latch when expansion drops to null', () => {
      const { result } = renderHook(() => useReserveExpansion({ isMobile: false }));

      act(() => result.current.setExpandedReserveId('reserve-A'));
      act(() => {
        result.current.suppressNextToggleReserveIdRef.current = 'reserve-A';
      });
      act(() => result.current.collapseExpanded());

      expect(result.current.suppressNextToggleReserveIdRef.current).toBeNull();
    });
  });

  describe('mobile→desktop transition', () => {
    it('collapses an expanded row when switching from mobile to desktop', () => {
      const { result, rerender } = renderHook(
        ({ isMobile }: { isMobile: boolean }) => useReserveExpansion({ isMobile }),
        { initialProps: { isMobile: true } },
      );

      act(() => result.current.setExpandedReserveId('reserve-A'));
      expect(result.current.expandedReserveId).toBe('reserve-A');

      rerender({ isMobile: false });
      expect(result.current.expandedReserveId).toBeNull();
      expect(result.current.suppressNextToggleReserveIdRef.current).toBeNull();
    });

    it('does not collapse when switching from desktop to mobile', () => {
      const { result, rerender } = renderHook(
        ({ isMobile }: { isMobile: boolean }) => useReserveExpansion({ isMobile }),
        { initialProps: { isMobile: false } },
      );

      act(() => result.current.setExpandedReserveId('reserve-A'));
      rerender({ isMobile: true });
      expect(result.current.expandedReserveId).toBe('reserve-A');
    });

    it('does nothing on mobile→desktop transition when no row is expanded', () => {
      const { result, rerender } = renderHook(
        ({ isMobile }: { isMobile: boolean }) => useReserveExpansion({ isMobile }),
        { initialProps: { isMobile: true } },
      );

      rerender({ isMobile: false });
      expect(result.current.expandedReserveId).toBeNull();
    });
  });
});
