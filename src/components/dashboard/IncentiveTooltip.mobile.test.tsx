// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import IncentiveTooltip from './IncentiveTooltip';
import type { ReserveWithSpread } from '@/types/aave';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
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
  reserveSize: '1000000000',
  supplyCap: '2000000000',
  borrowCap: '1000000000',
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

describe('IncentiveTooltip (Mobile)', () => {
  afterEach(() => cleanup());

  it('renders BottomSheet container', () => {
    const { container } = renderTooltip();
    const bottomSheet = container.querySelector('[role="dialog"]') || container.querySelector('.fixed.bottom-0');
    expect(bottomSheet).not.toBeNull();
  });

  it('renders correct title for supply type', () => {
    renderTooltip({ ...defaultProps, type: 'supply' });
    expect(screen.getByText('Supply Incentive Details')).toBeInTheDocument();
  });

  it('renders correct title for borrow type', () => {
    renderTooltip({ ...defaultProps, type: 'borrow' });
    expect(screen.getByText('Borrow Incentive Details')).toBeInTheDocument();
  });

  it('does not render desktop fixed tooltip container', () => {
    const { container } = renderTooltip();
    const desktopTooltip = container.querySelector('.fixed.z-40.rounded-xl');
    expect(desktopTooltip).toBeNull();
  });

  it('renders Protocol Incentive source in mobile layout', () => {
    const { container } = renderTooltip();
    expect(container.innerHTML).toContain('Protocol Incentive');
  });

  it('renders close button in mobile bottom sheet', () => {
    const { container } = renderTooltip();
    const closeButton = container.querySelector('button');
    expect(closeButton).not.toBeNull();
  });

  it('renders overlay for click-away dismiss', () => {
    const { container } = renderTooltip();
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
  });
});
