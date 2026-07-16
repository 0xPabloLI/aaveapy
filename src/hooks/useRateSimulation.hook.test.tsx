// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSharedRateSimulations } from './useRateSimulation';

vi.mock('@tanstack/react-query', () => ({
  useQueries: () => [],
}));

vi.mock('@/hooks/useSideDataMeta', () => ({
  useSideDataMeta: () => ({
    data: undefined,
    isPending: false,
    isFetching: false,
  }),
}));

describe('useSharedRateSimulations', () => {
  it('reports when a shared scenario input is active', () => {
    const { result } = renderHook(() =>
      useSharedRateSimulations({
        reserves: [],
        isApy: true,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 0,
        supplyInput: '100',
        borrowInput: '',
      }),
    );

    expect(result.current.hasAnyInput).toBe(true);
  });

  it('reports when a portfolio member has a negative delta', () => {
    const { result } = renderHook(() =>
      useSharedRateSimulations({
        reserves: [],
        isApy: true,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 0,
        supplyInput: '',
        borrowInput: '',
        perReserveInputs: new Map([
          [
            'reserve-1',
            {
              supplyInput: '-100',
              borrowInput: '0',
              inputMode: 'usd',
              totalSupplyUsd: 900,
            },
          ],
        ]),
      }),
    );

    expect(result.current.hasAnyInput).toBe(true);
  });
});
