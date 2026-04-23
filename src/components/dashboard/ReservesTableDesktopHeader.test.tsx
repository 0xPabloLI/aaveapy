import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Table } from '@/components/ui/table';
import ReservesTableDesktopHeader from './ReservesTableDesktopHeader';

describe('ReservesTableDesktopHeader', () => {
  it('renders desktop reserve table headings without throwing', () => {
    expect(() =>
      renderToString(
        <Table>
          <ReservesTableDesktopHeader
            tableHeaderRef={createRef<HTMLTableSectionElement>()}
            tableHeaderClassName="sticky z-20 bg-card/95"
            activeSortColumn="supply"
            tokenSortOrder="asc"
            marketSortOrder="asc"
            priceSortOrder="desc"
            sizeSortMode="supply"
            sizeSortOrder="desc"
            sizeSortActiveHeadingClass="ds-text-emerald-600 font-bold scale-105"
            utilSortMode="util"
            utilSortOrder="desc"
            showUtilSortMenu={false}
            utilMenuPos={null}
            utilSortButtonRef={createRef<HTMLButtonElement>()}
            supplySortLabel="Incentive"
            supplySortMode="incentive"
            supplySortOrder="desc"
            showSupplySortMenu={false}
            supplyMenuPos={null}
            borrowSortLabel="Total"
            borrowSortMode="total"
            borrowSortOrder="desc"
            showBorrowSortMenu={false}
            borrowMenuPos={null}
            spreadSortOrder="desc"
            showSizeSortMenu={false}
            sizeMenuPos={null}
            sizeSortButtonRef={createRef<HTMLButtonElement>()}
            supplySortButtonRef={createRef<HTMLButtonElement>()}
            borrowSortButtonRef={createRef<HTMLButtonElement>()}
            onSortToken={() => {}}
            onSortMarket={() => {}}
            onSortPrice={() => {}}
            onToggleUtilMenu={() => {}}
            onCloseUtilMenu={() => {}}
            onSelectUtilSortUtil={() => {}}
            onSelectUtilSortLiquidity={() => {}}
            onToggleSpreadSort={() => {}}
            onToggleSizeMenu={() => {}}
            onCloseSizeMenu={() => {}}
            onSelectSizeSortSupply={() => {}}
            onSelectSizeSortBorrow={() => {}}
            onSelectSizeSortBorrowAvailability={() => {}}
            onSelectSizeSortDeficitAmount={() => {}}
            onSelectSizeSortDeficitRatio={() => {}}
            onToggleSupplyMenu={() => {}}
            onCloseSupplyMenu={() => {}}
            onSelectSupplySortTotal={() => {}}
            onSelectSupplySortNative={() => {}}
            onSelectSupplySortIncentive={() => {}}
            onToggleBorrowMenu={() => {}}
            onCloseBorrowMenu={() => {}}
            onSelectBorrowSortTotal={() => {}}
            onSelectBorrowSortNative={() => {}}
            onSelectBorrowSortIncentive={() => {}}
          />
        </Table>,
      ),
    ).not.toThrow();
  });
});
