// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSharedScenarioInputs } from './useSharedScenarioInputs';
import type { ScenarioControlsHandle } from '@/components/dashboard/ScenarioControls';

function makeRef(handle: ScenarioControlsHandle | null = null) {
  return { current: handle };
}

describe('useSharedScenarioInputs', () => {
  it('starts with empty inputs, USD mode, net-position true, mobile sheet closed', () => {
    const { result } = renderHook(() =>
      useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
    );

    expect(result.current.debouncedSharedSupplyInput).toBe('');
    expect(result.current.debouncedSharedBorrowInput).toBe('');
    expect(result.current.sharedInputMode).toBe('usd');
    expect(result.current.meritMerklNetPosition).toBe(true);
    expect(result.current.mobileNetOpen).toBe(false);
  });

  describe('handleScenarioChange', () => {
    it('writes supply / borrow / mode together', () => {
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
      );

      act(() => result.current.handleScenarioChange('1000', '500', 'token'));
      expect(result.current.debouncedSharedSupplyInput).toBe('1000');
      expect(result.current.debouncedSharedBorrowInput).toBe('500');
      expect(result.current.sharedInputMode).toBe('token');
    });

    it('subsequent calls overwrite the previous values verbatim', () => {
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
      );

      act(() => result.current.handleScenarioChange('1', '2', 'usd'));
      act(() => result.current.handleScenarioChange('', '', 'usd'));
      expect(result.current.debouncedSharedSupplyInput).toBe('');
      expect(result.current.debouncedSharedBorrowInput).toBe('');
    });
  });

  describe('handleMobileNetToggle', () => {
    it('flips mobileNetOpen each call', () => {
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
      );

      act(() => result.current.handleMobileNetToggle());
      expect(result.current.mobileNetOpen).toBe(true);

      act(() => result.current.handleMobileNetToggle());
      expect(result.current.mobileNetOpen).toBe(false);
    });
  });

  describe('handleCorrectSupplyInput / handleCorrectBorrowInput', () => {
    it('forwards corrected supply value to the ScenarioControls handle', () => {
      const setSupplyInput = vi.fn();
      const setBorrowInput = vi.fn();
      const ref = makeRef({ setSupplyInput, setBorrowInput });
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: ref }),
      );

      act(() => result.current.handleCorrectSupplyInput('100'));
      expect(setSupplyInput).toHaveBeenCalledWith('100');
      expect(setBorrowInput).not.toHaveBeenCalled();
    });

    it('forwards corrected borrow value to the ScenarioControls handle', () => {
      const setSupplyInput = vi.fn();
      const setBorrowInput = vi.fn();
      const ref = makeRef({ setSupplyInput, setBorrowInput });
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: ref }),
      );

      act(() => result.current.handleCorrectBorrowInput('50'));
      expect(setBorrowInput).toHaveBeenCalledWith('50');
      expect(setSupplyInput).not.toHaveBeenCalled();
    });

    it('is a safe no-op when the imperative handle has not mounted yet', () => {
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef(null) }),
      );

      expect(() => result.current.handleCorrectSupplyInput('100')).not.toThrow();
      expect(() => result.current.handleCorrectBorrowInput('50')).not.toThrow();
    });
  });

  describe('setMeritMerklNetPosition', () => {
    it('updates the toggle directly (used as the controlled checkbox onChange)', () => {
      const { result } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
      );

      act(() => result.current.setMeritMerklNetPosition(false));
      expect(result.current.meritMerklNetPosition).toBe(false);
    });
  });

  describe('callback identity', () => {
    it('handleScenarioChange / handleMobileNetToggle keep stable references across renders', () => {
      const { result, rerender } = renderHook(() =>
        useSharedScenarioInputs({ scenarioControlsRef: makeRef() }),
      );

      const firstChange = result.current.handleScenarioChange;
      const firstToggle = result.current.handleMobileNetToggle;
      rerender();
      expect(result.current.handleScenarioChange).toBe(firstChange);
      expect(result.current.handleMobileNetToggle).toBe(firstToggle);
    });
  });
});
