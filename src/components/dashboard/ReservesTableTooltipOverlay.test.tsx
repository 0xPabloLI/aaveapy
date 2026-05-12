// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import ReservesTableTooltipOverlay from './ReservesTableTooltipOverlay';
import type { ReserveWithSpread } from '@/types/aave';

const makeReserve = (): ReserveWithSpread => ({
  reserveId: 'test-reserve',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenPrice: 1,
  decimals: 6,
  reserveSize: '1000000000000',
  supplyCap: '2000000000000',
  borrowCap: '1000000000000',
  utilizationPct: 45,
  optimalUsageRate: 80,
  variableRateSlope1: 4,
  variableRateSlope2: 60,
  baseVariableBorrowRate: 0,
  reserveFactor: 10,
  supplyApy: 4.2,
  borrowApy: 6.1,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
});

describe('ReservesTableTooltipOverlay', () => {
  afterEach(() => cleanup());

  it('renders nothing when tooltipState is null', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableTooltipOverlay
            tooltipState={null}
            onClose={vi.fn()}
            isApy
            tydroPointToUsdRate={0}
            whitelistMerklCampaignIds={new Set()}
            onToggleWhitelistMerklCampaign={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders IncentiveTooltip when tooltipState is provided', () => {
    const tooltipState = {
      reserve: makeReserve(),
      type: 'supply' as const,
      position: { x: 100, y: 200 },
      triggerCenterX: 150,
      triggerHeight: 40,
      triggerRect: { top: 200, bottom: 240, left: 130, right: 170, width: 40, height: 40 },
    };
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableTooltipOverlay
            tooltipState={tooltipState}
            onClose={vi.fn()}
            isApy
            tydroPointToUsdRate={0}
            whitelistMerklCampaignIds={new Set()}
            onToggleWhitelistMerklCampaign={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(container.innerHTML).not.toBe('');
  });

  it('renders tooltip content for supply type', () => {
    const tooltipState = {
      reserve: makeReserve(),
      type: 'supply' as const,
      position: { x: 100, y: 200 },
      triggerCenterX: 150,
      triggerHeight: 40,
      triggerRect: { top: 200, bottom: 240, left: 130, right: 170, width: 40, height: 40 },
    };
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableTooltipOverlay
            tooltipState={tooltipState}
            onClose={vi.fn()}
            isApy
            tydroPointToUsdRate={0}
            whitelistMerklCampaignIds={new Set()}
            onToggleWhitelistMerklCampaign={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(container.innerHTML).not.toBe('');
    expect(container.querySelector('.ds-tooltip-pad')).not.toBeNull();
  });

  it('renders tooltip content for borrow type', () => {
    const tooltipState = {
      reserve: makeReserve(),
      type: 'borrow' as const,
      position: { x: 100, y: 200 },
      triggerCenterX: 150,
      triggerHeight: 40,
      triggerRect: { top: 200, bottom: 240, left: 130, right: 170, width: 40, height: 40 },
    };
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ReservesTableTooltipOverlay
            tooltipState={tooltipState}
            onClose={vi.fn()}
            isApy
            tydroPointToUsdRate={0}
            whitelistMerklCampaignIds={new Set()}
            onToggleWhitelistMerklCampaign={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(container.innerHTML).not.toBe('');
    expect(container.querySelector('.ds-tooltip-pad')).not.toBeNull();
  });
});
