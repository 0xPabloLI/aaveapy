import { describe, it, expect, vi } from 'vitest';
import { buildSortActions, type BuildSortActionsInput, type SortKey } from './buildSortActions';
import type { SizeSortMode, UtilSortMode } from '@/lib/reservesSorter';

function makeInput(overrides: Partial<BuildSortActionsInput> = {}): BuildSortActionsInput {
  return {
    activeSortColumn: null,
    sizeSortMode: 'supply',
    sizeSortOrder: 'desc',
    utilSortMode: 'util',
    utilSortOrder: 'desc',
    setSizeSortMode: vi.fn(),
    setSizeSortOrder: vi.fn(),
    setUtilSortMode: vi.fn(),
    setUtilSortOrder: vi.fn(),
    setActiveSortColumn: vi.fn(),
    collapseExpandedOnSort: vi.fn(),
    ...overrides,
  };
}

const ALL_SIZE_KEYS: SizeSortMode[] = [
  'supply', 'borrow', 'borrowAvailability', 'supplyAvailability',
  'deficitRatio', 'deficitAmount', 'supplyCapPct', 'borrowCapPct',
  'supplyCapValue', 'borrowCapValue', 'availableLiquidity',
];

const ALL_UTIL_KEYS: UtilSortMode[] = ['util', 'optimal'];

const ALL_SORT_KEYS: SortKey[] = [...ALL_SIZE_KEYS, ...ALL_UTIL_KEYS];

describe('buildSortActions', () => {
  it('produces exactly 13 SortActions (11 size + 2 util)', () => {
    const actions = buildSortActions(makeInput());
    expect(Object.keys(actions)).toHaveLength(13);
    for (const key of ALL_SORT_KEYS) {
      expect(actions[key]).toBeDefined();
      expect(actions[key]).toHaveProperty('onSort');
      expect(actions[key]).toHaveProperty('isActive');
      expect(actions[key]).toHaveProperty('sortOrder');
    }
  });

  describe('isActive — size column', () => {
    for (const key of ALL_SIZE_KEYS) {
      it(`${key}: isActive only when activeSortColumn==='size' && sizeSortMode==='${key}'`, () => {
        const active = buildSortActions(makeInput({ activeSortColumn: 'size', sizeSortMode: key }));
        expect(active[key].isActive).toBe(true);
        for (const other of ALL_SORT_KEYS) {
          if (other !== key) expect(active[other].isActive).toBe(false);
        }
        const notActive = buildSortActions(makeInput({ activeSortColumn: 'util', sizeSortMode: key }));
        expect(notActive[key].isActive).toBe(false);
        const noColumn = buildSortActions(makeInput({ activeSortColumn: null, sizeSortMode: key }));
        expect(noColumn[key].isActive).toBe(false);
      });
    }
  });

  describe('isActive — util column', () => {
    for (const key of ALL_UTIL_KEYS) {
      it(`${key}: isActive only when activeSortColumn==='util' && utilSortMode==='${key}'`, () => {
        const active = buildSortActions(makeInput({ activeSortColumn: 'util', utilSortMode: key }));
        expect(active[key].isActive).toBe(true);
        for (const other of ALL_SORT_KEYS) {
          if (other !== key) expect(active[other].isActive).toBe(false);
        }
        const notActive = buildSortActions(makeInput({ activeSortColumn: 'size', utilSortMode: key }));
        expect(notActive[key].isActive).toBe(false);
      });
    }
  });

  describe('sortOrder', () => {
    it('all size keys share sizeSortOrder', () => {
      const actions = buildSortActions(makeInput({ sizeSortOrder: 'asc' }));
      for (const key of ALL_SIZE_KEYS) {
        expect(actions[key].sortOrder).toBe('asc');
      }
    });

    it('all util keys share utilSortOrder', () => {
      const actions = buildSortActions(makeInput({ utilSortOrder: 'asc' }));
      for (const key of ALL_UTIL_KEYS) {
        expect(actions[key].sortOrder).toBe('asc');
      }
    });

    it('size and util can have independent orders', () => {
      const actions = buildSortActions(makeInput({ sizeSortOrder: 'asc', utilSortOrder: 'desc' }));
      expect(actions.supply.sortOrder).toBe('asc');
      expect(actions.util.sortOrder).toBe('desc');
    });
  });

  describe('onSort — size keys (not already selected)', () => {
    for (const key of ALL_SIZE_KEYS) {
      it(`${key}: calls collapseExpandedOnSort then sets mode + column + order`, () => {
        const input = makeInput({ sizeSortMode: 'borrow', activeSortColumn: null });
        const actions = buildSortActions(input);
        actions[key].onSort();
        expect(input.collapseExpandedOnSort).toHaveBeenCalledOnce();
        expect(input.setSizeSortMode).toHaveBeenCalledWith(key);
        expect(input.setActiveSortColumn).toHaveBeenCalledWith('size');
        expect(input.setSizeSortOrder).toHaveBeenCalledWith('desc');
      });
    }
  });

  describe('onSort — util keys (not already selected)', () => {
    for (const key of ALL_UTIL_KEYS) {
      it(`${key}: calls collapseExpandedOnSort then sets mode + column + order`, () => {
        const input = makeInput({ utilSortMode: 'optimal', activeSortColumn: null });
        const actions = buildSortActions(input);
        actions[key].onSort();
        expect(input.collapseExpandedOnSort).toHaveBeenCalledOnce();
        expect(input.setUtilSortMode).toHaveBeenCalledWith(key);
        expect(input.setActiveSortColumn).toHaveBeenCalledWith('util');
        expect(input.setUtilSortOrder).toHaveBeenCalledWith('desc');
      });
    }
  });

  describe('onSort — toggle behavior', () => {
    it('size key: when already selected, toggles order instead of resetting', () => {
      const input = makeInput({ sizeSortMode: 'supply', activeSortColumn: 'size', sizeSortOrder: 'desc' });
      const actions = buildSortActions(input);
      actions.supply.onSort();
      expect(input.setSizeSortMode).not.toHaveBeenCalled();
      expect(input.setActiveSortColumn).not.toHaveBeenCalled();
      expect(input.setSizeSortOrder).toHaveBeenCalledWith(expect.any(Function));
    });

    it('util key: when already selected, toggles order instead of resetting', () => {
      const input = makeInput({ utilSortMode: 'util', activeSortColumn: 'util', utilSortOrder: 'desc' });
      const actions = buildSortActions(input);
      actions.util.onSort();
      expect(input.setUtilSortMode).not.toHaveBeenCalled();
      expect(input.setActiveSortColumn).not.toHaveBeenCalled();
      expect(input.setUtilSortOrder).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
