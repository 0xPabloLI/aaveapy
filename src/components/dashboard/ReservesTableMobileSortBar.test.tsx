import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReservesTableMobileSortBar from './ReservesTableMobileSortBar';

const baseProps = {
  activeSortColumn: null,
  sizeSortAccentClass: 'ds-text-emerald-700',
  utilSortAccentClass: 'text-foreground',
  mobileExtraSortActive: false,
  mobileExtraSortChipLabel: 'Spread',
  showSizeSortMenu: false,
  showUtilSortMenu: false,
  showSupplySortMenu: false,
  showBorrowSortMenu: false,
  showExtraSortMenu: false,
  sizeSortOptions: [
    { key: 'supply', label: 'Supply', isSelected: false, order: 'desc' as const, activeClassName: 'ds-text-emerald-600', onSelect: () => {} },
  ],
  utilSortOptions: [
    { key: 'util', label: 'Util Rate', isSelected: false, order: 'desc' as const, activeClassName: 'text-foreground', onSelect: () => {} },
    { key: 'liquidity', label: 'Available Amount', isSelected: false, order: 'desc' as const, activeClassName: 'ds-text-purple-600', onSelect: () => {} },
  ],
  supplySortOptions: [
    { key: 'total', label: 'Total', isSelected: false, order: 'desc' as const, activeClassName: 'ds-text-emerald-600', onSelect: () => {} },
  ],
  borrowSortOptions: [
    { key: 'total', label: 'Total', isSelected: false, order: 'desc' as const, activeClassName: 'ds-text-brand-cyan', onSelect: () => {} },
  ],
  extraSortOptions: [
    { key: 'spread', label: 'Spread', isSelected: false, order: 'desc' as const, activeClassName: 'ds-text-purple-600', onSelect: () => {} },
    { key: 'token', label: 'Token', isSelected: false, order: 'asc' as const, activeClassName: 'text-foreground', onSelect: () => {} },
  ],
  onToggleMenu: (_menu: import('./ReservesTableMobileSortBar').MobileSortMenuKey) => {},
  onCloseMenus: () => {},
};

describe('ReservesTableMobileSortBar', () => {
  it('renders without throwing', () => {
    expect(() => renderToString(<ReservesTableMobileSortBar {...baseProps} />)).not.toThrow();
  });

  it('does not render reserves count text', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} />);
    expect(html).not.toContain('Reserves');
  });

  it('applies overflow-visible on each chip container so dropdowns are not clipped', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} />);
    expect(html).toContain('relative overflow-visible');
  });

  it('renders chips in desktop-matching order: Size → Util → Supply → Borrow → Extra', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} />);
    const sizeIdx = html.indexOf('>Size<');
    const utilIdx = html.indexOf('>Liquidity<');
    const supplyIdx = html.indexOf('>Supply<');
    const borrowIdx = html.indexOf('>Borrow<');
    const extraIdx = html.indexOf('>Spread<');
    expect([sizeIdx, utilIdx, supplyIdx, borrowIdx, extraIdx]).toEqual(
      [sizeIdx, utilIdx, supplyIdx, borrowIdx, extraIdx].sort((a, b) => a - b),
    );
  });

  it('renders independent Util chip with dropdown menu options', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} showUtilSortMenu />);
    expect(html).toContain('>Liquidity<');
    expect(html).toContain('Util Rate');
    expect(html).toContain('Available Amount');
  });

  it('aligns left-side chip menus (Size/Util/Supply) with left-0 to prevent left-edge overflow', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} showSizeSortMenu />);
    const allAbsoluteDivs = [...html.matchAll(/absolute (left-0|right-0)/g)];
    expect(allAbsoluteDivs.length).toBeGreaterThanOrEqual(1);
    expect(allAbsoluteDivs[0][1]).toBe('left-0');
  });

  it('aligns right-side chip menus (Borrow/Extra) with right-0 to prevent right-edge overflow', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} showBorrowSortMenu showExtraSortMenu />);
    const absoluteMatches = [...html.matchAll(/absolute (left-0|right-0)/g)];
    const rightAligned = absoluteMatches.filter((m) => m[1] === 'right-0');
    expect(rightAligned.length).toBeGreaterThanOrEqual(2);
  });

  it('constrains menu width with viewport-aware max-w', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} showSizeSortMenu />);
    expect(html).toContain('max-w-[min(18rem,calc(100vw-1.5rem))]');
  });

  it('excludes utilization options from Extra menu (moved to dedicated Util chip)', () => {
    const html = renderToString(<ReservesTableMobileSortBar {...baseProps} showExtraSortMenu />);
    const extraMenuMatch = html.match(/<div[^>]*absolute right-0[^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<\/div>\s*$)/);
    expect(extraMenuMatch).not.toBeNull();
    const extraMenuContent = extraMenuMatch![1];
    expect(extraMenuContent).not.toContain('Util Rate');
    expect(extraMenuContent).not.toContain('Available Amount');
    expect(extraMenuContent).toContain('Spread');
    expect(extraMenuContent).toContain('Token');
  });
});
