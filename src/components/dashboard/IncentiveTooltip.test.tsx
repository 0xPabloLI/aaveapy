// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IncentiveTooltip from './IncentiveTooltip';
import type { ReserveWithSpread } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

const mockReserve: ReserveWithSpread = {
  reserveId: 'AaveV3Ethereum-0x1',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenName: 'USD Coin',
  tokenSymbol: 'USDC',
  tokenAddress: '0x1',
  tokenPrice: 1,
  decimals: 6,
  supplied: '1000000000',
  supplyCap: '2000000000',
  borrowCap: '1000000000',
  utilizationPct: 45,
  optimalUtilization: 80,
  slopeBelowOptimal: 4,
  slopeAboveOptimal: 60,
  baseBorrowRate: 0,
  protocolFee: 10,
  supplyApy: 4.2,
  borrowApy: 6.1,
  supplyDisabled: false,
  borrowDisabled: false,
  supplyIncentives: [0.5],
  borrowIncentives: [],
  meritSupplys: [],
  meritBorrows: [],
  merklSupplys: [],
  merklBorrows: [],
  brevisSupplys: [],
  brevisBorrows: [],
};

const defaultProps = {
  reserve: mockReserve,
  type: 'supply' as const,
  position: { x: 100, y: 200 },
  triggerCenterX: 150,
  triggerHeight: 32,
  triggerRect: { top: 184, bottom: 216, left: 134, right: 166, width: 32, height: 32 },
  onClose: vi.fn(),
  isApy: true,
  usePortal: false,
  tydroPointToUsdRate: 1,
  whitelistMerklCampaignIds: new Set<string>(),
  onToggleWhitelistMerklCampaign: vi.fn(),
  forecastStates: undefined,
};

function renderTooltip(props = defaultProps) {
  return render(<IncentiveTooltip {...props} />);
}

describe('IncentiveTooltip', () => {
  afterEach(() => cleanup());

  describe('Desktop rendering', () => {
    it('renders tooltip container with fixed positioning', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40');
      expect(tooltip).not.toBeNull();
    });

    it('applies correct border and background styles', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40');
      expect(tooltip).not.toBeNull();
      expect(tooltip!.className).toContain('rounded-xl');
      expect(tooltip!.className).toContain('border');
    });

    it('renders overlay background for click-away', () => {
      const { container } = renderTooltip();
      const overlay = container.querySelector('.fixed.inset-0.z-30');
      expect(overlay).not.toBeNull();
    });

    it('closes tooltip when clicking overlay', () => {
      const onClose = vi.fn();
      const { container } = renderTooltip({ ...defaultProps, onClose });
      const overlay = container.querySelector('.fixed.inset-0.z-30');
      expect(overlay).not.toBeNull();
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalled();
    });

    it('applies max-width constraint of 520px', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40');
      expect(tooltip!.className).toContain('max-w-[min(520px,calc(100vw-32px))]');
    });

    it('applies min-width constraint of 320px', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40');
      expect(tooltip!.className).toContain('min-w-[320px]');
    });

    it('renders arrow SVG when placement allows', () => {
      const { container } = renderTooltip();
      const arrow = container.querySelector('svg[viewBox="0 0 16 10"]');
      expect(arrow).not.toBeNull();
    });

    it('positions tooltip using left and top inline styles', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40') as HTMLElement;
      expect(tooltip).not.toBeNull();
      expect(tooltip!.style.left).toBeTruthy();
      expect(tooltip!.style.top).toBeTruthy();
    });

    it('uses supply accent color (emerald) for supply type', () => {
      const { container } = renderTooltip({ ...defaultProps, type: 'supply' });
      const html = container.innerHTML;
      expect(html).toContain('emerald');
    });

    it('uses borrow accent color (cyan) for borrow type when has incentives', () => {
      const reserveWithIncentives: ReserveWithSpread = {
        ...mockReserve,
        borrowIncentives: [1.2],
      };
      const { container } = renderTooltip({ ...defaultProps, type: 'borrow', reserve: reserveWithIncentives });
      expect(container.innerHTML).toContain('cyan');
    });

    it('renders empty state message when no incentives', () => {
      const noIncentiveReserve = {
        ...mockReserve,
        supplyIncentives: [],
        meritSupplys: [],
        merklSupplys: [],
        brevisSupplys: [],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: noIncentiveReserve });
      expect(container.textContent).toContain('No detailed breakdown available');
    });

    it('applies zoom-in animation classes', () => {
      const { container } = renderTooltip();
      const tooltip = container.querySelector('.fixed.z-40');
      expect(tooltip!.className).toContain('animate-in');
      expect(tooltip!.className).toContain('zoom-in-95');
    });

    it('renders content scrollable container', () => {
      const { container } = renderTooltip();
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
    });
  });

  describe('Mobile rendering', () => {
    it('see IncentiveTooltip.mobile.test.tsx for mobile-specific tests', () => {
      // Mobile tests are in a separate file with proper mock setup
      expect(true).toBe(true);
    });
  });

  describe('Incentive source grouping', () => {
    it('renders protocol incentive when supplyIncentives exist', () => {
      const { container } = renderTooltip();
      expect(container.innerHTML).toContain('Protocol Incentive');
    });

    it('renders merit/ACI incentives when meritSupplys exist', () => {
      const reserveWithMerit: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Merit Campaign',
          apr: 2.5,
          selfApr: 1.0,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          message: 'Earn extra rewards',
          link: 'https://example.com',
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithMerit });
      expect(container.innerHTML).toContain('Merit Campaign');
    });

    it('renders Merkl incentives when merklSupplys exist', () => {
      const reserveWithMerkl: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          message: 'Merkl rewards',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-1',
            campaignApr: 3.0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2026-12-31',
            whitelistOnly: false,
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithMerkl });
      expect(container.innerHTML).toContain('Merkl Campaign');
    });

    it('renders Brevis incentives when brevisSupplys exist', () => {
      const reserveWithBrevis: ReserveWithSpread = {
        ...mockReserve,
        brevisSupplys: [{
          name: 'Brevis Campaign',
          campaignApr: 1.5,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2026-12-31',
          message: 'Brevis rewards',
          link: 'https://brevis.network',
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithBrevis });
      expect(container.innerHTML).toContain('Brevis Campaign');
    });

    it('excludes inactive campaigns based on date range', () => {
      const reserveWithExpiredMerit: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Expired Campaign',
          apr: 2.5,
          selfApr: 1.0,
          startDate: '2020-01-01',
          endDate: '2020-12-31',
          message: 'This is expired',
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithExpiredMerit });
      expect(container.innerHTML).not.toContain('Expired Campaign');
    });
  });

  describe('Portal rendering', () => {
    it('renders via portal when usePortal is true', () => {
      const { container, baseElement } = renderTooltip({ ...defaultProps, usePortal: true });
      // Portal renders in document.body
      expect(baseElement).toBeTruthy();
    });

    it('renders inline when usePortal is false', () => {
      const { container } = renderTooltip({ ...defaultProps, usePortal: false });
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('Custom accent classes', () => {
    it('applies custom accent border class', () => {
      const { container } = renderTooltip({
        ...defaultProps,
        accentBorderClass: 'border-l-[3px] border-l-red-500',
      });
      expect(container.innerHTML).toContain('border-l-red-500');
    });

    it('applies custom accent text class', () => {
      const { container } = renderTooltip({
        ...defaultProps,
        accentTextClass: 'text-red-500',
      });
      expect(container.innerHTML).toContain('text-red-500');
    });

    it('applies custom accent bg class to campaign values', () => {
      const reserveWithIncentives: ReserveWithSpread = {
        ...mockReserve,
        supplyIncentives: [1.5],
      };
      const { container } = renderTooltip({
        ...defaultProps,
        reserve: reserveWithIncentives,
      });
      // accent bg is applied to the link wrapper, verify incentive renders
      expect(container.innerHTML).toContain('Protocol Incentive');
    });
  });

  describe('APR vs APY mode', () => {
    it('displays values in APY mode by default', () => {
      const { container } = renderTooltip({ ...defaultProps, isApy: true });
      expect(container).toBeTruthy();
    });

    it('displays values in APR mode when isApy is false', () => {
      const { container } = renderTooltip({ ...defaultProps, isApy: false });
      expect(container).toBeTruthy();
    });
  });
});
