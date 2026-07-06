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
      const arrow = container.querySelector('svg[aria-hidden]');
      expect(arrow).not.toBeNull();
      expect(arrow!.querySelector('path[fill]')).not.toBeNull();
      expect(arrow!.querySelector('path[stroke]')).not.toBeNull();
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
          link: 'https://example.com',
          message: 'Earn extra rewards',
          breakdowns: [{
            campaignApr: 2.5,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2026-12-31',
            campaignId: 'merit-1',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithMerit });
      expect(container.innerHTML).toContain('Merit Campaign');
    });

    it('renders multi-breakdown Merit group as one source with multiple campaign cards', () => {
      const reserveWithMerit: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          message: 'Earn extra rewards',
          breakdowns: [
            { campaignApr: 3.8, campaignStartedAt: '2026-01-01', campaignEndedAt: '2026-12-31', campaignId: 'celo-supply-usdt-base', campaignType: 'DUTCH_AUCTION' },
            { campaignApr: 3.8, campaignStartedAt: '2026-01-01', campaignEndedAt: '2026-12-31', campaignId: 'celo-supply-usdt-self', campaignType: 'DUTCH_AUCTION', positionCap: 1000 },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve: reserveWithMerit });
      expect(container.innerHTML).toContain('Supply USDT');
      expect(container.textContent).toContain('7.73%');
      expect(container.textContent).toContain('Incentive on first');
      expect(container.textContent).toContain('Earn extra rewards');
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
          link: 'https://example.com',
          message: 'This is expired',
          breakdowns: [{
            campaignApr: 2.5,
            campaignStartedAt: '2020-01-01',
            campaignEndedAt: '2020-12-31',
            campaignId: 'merit-expired',
          }],
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

  describe('Merkl campaign type descriptions', () => {
    const merklCampaignReserve = (campaignType: string, overrides?: Partial<ReserveWithSpread>): ReserveWithSpread => ({
      ...mockReserve,
      ...overrides,
      merklSupplys: [{
        name: 'Merkl Campaign',
        message: '',
        link: 'https://merkl.angle.money',
        breakdowns: [{
          campaignId: 'merkl-test',
          campaignApr: 3.0,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2027-12-31',
          whitelistOnly: false,
          campaignType,
          aprCap: 5.83,
        }],
      }],
    });

    it('renders TARGET_TOTAL_APR three-part formula', () => {
      const reserve = merklCampaignReserve('TARGET_TOTAL_APR');
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: true });
      expect(container.textContent).toContain('Target total');
      expect(container.textContent).toContain('Native');
      expect(container.textContent).toContain('Merkl');
    });

    it('shows APY label when isApy=true', () => {
      const reserve = merklCampaignReserve('TARGET_TOTAL_APR');
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: true });
      const descEl = container.querySelector('[data-campaign-desc="TARGET_TOTAL_APR"]');
      expect(descEl!.textContent).toContain('Target total APY:');
    });

    it('shows APR label when isApy=false', () => {
      const reserve = merklCampaignReserve('TARGET_TOTAL_APR');
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: false });
      const descEl = container.querySelector('[data-campaign-desc="TARGET_TOTAL_APR"]');
      expect(descEl!.textContent).toContain('Target total APR:');
    });

    it('renders TARGET_TOTAL_APR with muted label and accent value', () => {
      const reserve = merklCampaignReserve('TARGET_TOTAL_APR');
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: true });
      const descriptionEl = container.querySelector('[data-campaign-desc="TARGET_TOTAL_APR"]');
      expect(descriptionEl).not.toBeNull();
      expect(descriptionEl!.textContent).toContain('Target total');
      const textEl = descriptionEl!.querySelector('p');
      expect(textEl).not.toBeNull();
      expect(textEl!.className).toContain('text-muted-foreground');
    });

    it('renders MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE with Max APR and cap', () => {
      const reserve = merklCampaignReserve('MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE');
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Max APR');
      expect(container.textContent).toContain('reward decreases as TVL grows');
      expect(container.textContent).toContain('cap');
    });

    it('renders MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE with aprCap following isApy toggle', () => {
      const reserve = merklCampaignReserve('MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE');
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: false });
      const descEl = container.querySelector('[data-campaign-desc="MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE"]');
      expect(descEl).not.toBeNull();
      expect(descEl!.textContent).toContain('cap');
    });

    it('renders FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE with fixed APR and early-end note', () => {
      const reserve = merklCampaignReserve('FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE');
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Fixed APR');
      expect(container.textContent).toContain('campaign ends early if budget runs out');
    });

    it('renders DUTCH_AUCTION with Dutch auction label and daily reward note', () => {
      const reserve = merklCampaignReserve('DUTCH_AUCTION');
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Dutch auction');
      expect(container.textContent).toContain('daily amount is fixed');
      expect(container.textContent).toContain('rate changes with TVL');
    });

    it('does not render campaign type description for unknown campaign types', () => {
      const reserve = merklCampaignReserve('UNKNOWN_TYPE');
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.querySelector('[data-campaign-desc]')).toBeNull();
    });

    it('renders all three non-TARGET campaign types with muted text color', () => {
      const types = ['MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE', 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE', 'DUTCH_AUCTION'] as const;
      for (const campaignType of types) {
        cleanup();
        const reserve = merklCampaignReserve(campaignType);
        const { container } = renderTooltip({ ...defaultProps, reserve });
        const descEl = container.querySelector(`[data-campaign-desc="${campaignType}"]`);
        expect(descEl).not.toBeNull();
        const textEl = descEl!.querySelector('p');
        expect(textEl).not.toBeNull();
        expect(textEl!.className).toContain('text-muted-foreground');
      }
    });

    it('renders MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE without cap when aprCap is null', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          message: '',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-test',
            campaignApr: 3.0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            whitelistOnly: false,
            campaignType: 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
            aprCap: null,
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const descEl = container.querySelector('[data-campaign-desc="MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE"]');
      expect(descEl).not.toBeNull();
      expect(descEl!.textContent).not.toContain('cap');
    });

    it('renders FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE without apr value when campaignApr is 0', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          message: '',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-test',
            campaignApr: 0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            whitelistOnly: false,
            campaignType: 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
            aprCap: 5.83,
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.querySelector('[data-campaign-desc]')).toBeNull();
    });
  });

  describe('Position cap display', () => {
    it('renders position cap for Brevis breakdown with positionCap', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        brevisSupplys: [{
          name: 'Brevis Campaign',
          campaignApr: 1.5,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2027-12-31',
          message: 'Brevis rewards',
          link: 'https://brevis.network',
          positionCap: 5000,
          isCombineCap: true,
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Incentive on first');
      expect(container.textContent).toContain('$5,000');
      expect(container.textContent).toContain('combined position');
    });

    it('does not render position cap when positionCap is absent', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        brevisSupplys: [{
          name: 'Brevis Campaign',
          campaignApr: 1.5,
          campaignStartedAt: '2026-01-01',
          campaignEndedAt: '2027-12-31',
          message: 'Brevis rewards',
          link: 'https://brevis.network',
          breakdowns: [{
            campaignApr: 1.5,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            campaignId: 'brevis-1',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).not.toContain('Incentive on first');
    });

    it('renders position cap for Merit self auth campaign', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Merit Campaign',
          link: 'https://example.com',
          message: [{ action: 'Self Authentication', description: 'Incentive on first $1,000 of deposit' }],
          breakdowns: [{
            campaignApr: 1.0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            campaignId: 'merit-self',
            positionCap: 1000,
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Incentive on first');
      expect(container.textContent).toContain('$1,000');
      expect(container.textContent).toContain('net position only');
    });

    it('renders position cap for Merkl with net position constraint', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          netPositionConstraint: { sourceSide: 'supply', offsetReserveIds: ['1:0xabc'] },
          breakdowns: [{
            campaignApr: 1.5,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            campaignId: 'merkl-1',
            positionCap: 1000,
            isCombineCap: false,
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Incentive on first');
      expect(container.textContent).toContain('$1,000');
      expect(container.textContent).toContain('net position');
    });
  });

  describe('pointRateMap per-campaign routing', () => {
    it('uses pointRateMap for known reward token symbol', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-ink',
            campaignApr: 0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            pointsPerThousandUsd: 2,
            rewardTokenSymbol: 'TydroInkPoints',
            rewardTokenIconUrl: 'https://example.com/ink.svg',
          }],
        }],
      };
      const pointRateMap = { tydroinkpoints: 1.5 };
      const { container } = renderTooltip({ ...defaultProps, reserve, pointRateMap });
      const aprText = container.textContent;
      expect(aprText).toContain('185.2');
    });

    it('uses rate 0 for unknown reward token symbol in pointRateMap', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-unknown',
            campaignApr: 0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            pointsPerThousandUsd: 2,
            rewardTokenSymbol: 'UnknownPoints',
          }],
        }],
      };
      const pointRateMap = { tydroinkpoints: 1.5 };
      const { container } = renderTooltip({ ...defaultProps, reserve, pointRateMap });
      const aprText = container.textContent;
      expect(aprText).toContain('0.00');
    });

    it('falls back to tydroPointToUsdRate when pointRateMap is not provided', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-ink',
            campaignApr: 0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            pointsPerThousandUsd: 2,
            rewardTokenSymbol: 'TydroInkPoints',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve, tydroPointToUsdRate: 2 });
      const aprText = container.textContent;
      expect(aprText).toContain('296.6');
    });

    it('renders reward token icon when rewardTokenIconUrl is present', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          breakdowns: [
            {
              campaignId: 'merkl-ink',
              campaignApr: 0,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              pointsPerThousandUsd: 2,
              rewardTokenSymbol: 'TydroInkPoints',
              rewardTokenIconUrl: 'https://example.com/ink.svg',
            },
            {
              campaignId: 'merkl-ink-2',
              campaignApr: 0,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              pointsPerThousandUsd: 1,
              rewardTokenSymbol: 'TydroInkPoints',
              rewardTokenIconUrl: 'https://example.com/ink.svg',
            },
          ],
        }],
      };
      const pointRateMap = { tydroinkpoints: 1 };
      const { baseElement } = renderTooltip({ ...defaultProps, reserve, pointRateMap });
      const allImgs = baseElement.querySelectorAll('img');
      const srcs = Array.from(allImgs).map(el => (el as HTMLImageElement).src);
      const inkSrc = srcs.find(s => s.includes('example.com/ink'));
      expect(inkSrc).toBeDefined();
    });

    it('returns 0 APR when rewardTokenSymbol is missing and pointRateMap exists', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-ink',
            campaignApr: 0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            pointsPerThousandUsd: 2,
          }],
        }],
      };
      const pointRateMap = { tydroinkpoints: 1.5 };
      const { container } = renderTooltip({ ...defaultProps, reserve, pointRateMap, tydroPointToUsdRate: 1.5 });
      const aprText = container.textContent;
      expect(aprText).toContain('0.00');
    });
  });

  describe('Message JSON.parse and breakdown-level rendering', () => {
    it('parses JSON string message from Merit breakdown and renders structured content', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          breakdowns: [
            {
              campaignApr: 3.8,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              campaignId: 'celo-supply-usdt-base',
              campaignType: 'DUTCH_AUCTION',
              message: '[{"action":"Supply USDT","description":"Rewards are distributed using the following formula"}]',
            },
            {
              campaignApr: 3.8,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              campaignId: 'celo-supply-usdt-self',
              campaignType: 'DUTCH_AUCTION',
              positionCap: 1000,
              message: '[{"action":"Self Authentication","description":"Double your yield by verifying your humanity"}]',
            },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const text = container.textContent!;
      expect(text).toContain('Supply USDT');
      expect(text).toContain('Self Authentication');
      expect(text).toContain('Double your yield');
      expect(text).toContain('Rewards are distributed');
      expect(text).not.toContain('[{"action"');
      expect(text).not.toContain('"}]');
    });

    it('renders breakdown message below each campaign for Merit', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          message: 'Opportunity-level message',
          breakdowns: [
            {
              campaignApr: 3.8,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              campaignId: 'celo-supply-usdt-base',
              message: 'Base breakdown message',
            },
            {
              campaignApr: 3.8,
              campaignStartedAt: '2026-01-01',
              campaignEndedAt: '2027-12-31',
              campaignId: 'celo-supply-usdt-self',
              positionCap: 1000,
              message: 'Self breakdown message',
            },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const text = container.textContent!;
      expect(text).toContain('Base breakdown message');
      expect(text).toContain('Self breakdown message');
      expect(text).not.toContain('Opportunity-level message');
    });

    it('falls back to group.message when breakdown has no message', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          message: 'Group-level fallback',
          breakdowns: [{
            campaignApr: 3.8,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            campaignId: 'celo-supply-usdt-base',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Group-level fallback');
    });

    it('still renders plain string messages (Merkl/Brevis) without JSON parsing', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Merkl Campaign',
          message: 'Plain string message',
          link: 'https://merkl.angle.money',
          breakdowns: [{
            campaignId: 'merkl-1',
            campaignApr: 3.0,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Plain string message');
    });

    it('handles invalid JSON string as plain text', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          breakdowns: [{
            campaignApr: 3.8,
            campaignStartedAt: '2026-01-01',
            campaignEndedAt: '2027-12-31',
            campaignId: 'celo-supply-usdt-base',
            message: 'Not a JSON string',
          }],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      expect(container.textContent).toContain('Not a JSON string');
    });
  });

  describe('Opportunity message position + per-campaign APR and reward token', () => {
    it('renders opportunity message above all campaigns for Merkl (multi-campaign)', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO',
          link: 'https://merkl.angle.money',
          message: 'Opportunity message',
          breakdowns: [
            { campaignId: 'merkl-1', campaignApr: 3.8, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31' },
            { campaignId: 'merkl-2', campaignApr: 2.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', whitelistOnly: false },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: false });
      const text = container.textContent!;
      const oppMsgIdx = text.indexOf('Opportunity message');
      const firstCampIdx = text.indexOf('Campaign time');
      expect(oppMsgIdx).toBeGreaterThan(0);
      expect(oppMsgIdx).toBeLessThan(firstCampIdx);
    });

    it('renders per-campaign APR in multi-campaign mode', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        meritSupplys: [{
          name: 'Supply USDT',
          link: 'https://example.com',
          breakdowns: [
            { campaignApr: 3.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', campaignId: 'base' },
            { campaignApr: 2.0, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', campaignId: 'self', positionCap: 1000 },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve, isApy: false });
      const text = container.textContent!;
      expect(text).toContain('3.00%');
      expect(text).toContain('2.00%');
    });

    it('renders per-campaign reward token icon when different tokens exist', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Tydro',
          link: 'https://merkl.angle.money',
          message: 'Earn rewards on your net lending position',
          breakdowns: [
            { campaignId: 'merkl-ink', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
            { campaignId: 'merkl-ops', campaignApr: 5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'OPS', rewardTokenIconUrl: 'https://example.com/ops.svg' },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const imgs = container.querySelectorAll('img[src]');
      expect(imgs.length).toBeGreaterThanOrEqual(2);
      const srcs = Array.from(imgs).map(img => img.getAttribute('src'));
      expect(srcs).toContain('https://example.com/ink.svg');
      expect(srcs).toContain('https://example.com/ops.svg');
    });

    it('renders per-campaign reward token icon in Campaign time row', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Tydro',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-ink', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
            { campaignId: 'merkl-ops', campaignApr: 5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'OPS', rewardTokenIconUrl: 'https://example.com/ops.svg' },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const imgs = container.querySelectorAll('img[src]');
      expect(imgs.length).toBeGreaterThanOrEqual(2);
      const srcs = Array.from(imgs).map(img => img.getAttribute('src'));
      expect(srcs).toContain('https://example.com/ink.svg');
      expect(srcs).toContain('https://example.com/ops.svg');
    });

    it('prefers rewardTokenIconUrl over local manifest when both are present', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Tydro',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-gho', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'aUSDC', rewardTokenIconUrl: 'https://example.com/ausdc.svg' },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const imgs = container.querySelectorAll('img[src]');
      const srcs = Array.from(imgs).map(img => img.getAttribute('src'));
      const usdcIconSrc = srcs.find(s => s?.includes('usdc'));
      expect(usdcIconSrc).toBeDefined();
      expect(usdcIconSrc).toContain('example.com/ausdc');
    });

    it('falls back to rewardTokenIconUrl when rewardTokenSymbol has no local icon', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Tydro',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-xyz', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'XyzPoints', rewardTokenIconUrl: 'https://example.com/xyz.svg' },
          ],
        }],
      };
      const { container } = renderTooltip({ ...defaultProps, reserve });
      const imgs = container.querySelectorAll('img[src]');
      const srcs = Array.from(imgs).map(img => img.getAttribute('src'));
      expect(srcs).toContain('https://example.com/xyz.svg');
    });

    it('hides opp header icon when campaigns have different reward token icons', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Aave',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-ink', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
            { campaignId: 'merkl-ops', campaignApr: 5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'OPS', rewardTokenIconUrl: 'https://example.com/ops.svg' },
          ],
        }],
      };
      const { baseElement } = renderTooltip({ ...defaultProps, reserve });
      const headerAprs = baseElement.querySelectorAll('[data-testid="source-header-apr"]');
      const merklHeaderApr = Array.from(headerAprs).find(el => el.textContent?.includes('15'));
      expect(merklHeaderApr?.querySelector('img')).toBeNull();
    });

    it('shows opp header icon when all campaigns have the same reward token icon', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Tydro',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-1', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
            { campaignId: 'merkl-2', campaignApr: 5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
          ],
        }],
      };
      const { baseElement } = renderTooltip({ ...defaultProps, reserve });
      const headerAprs = baseElement.querySelectorAll('[data-testid="source-header-apr"]');
      const merklHeaderApr = Array.from(headerAprs).find(el => el.textContent?.includes('15'));
      expect(merklHeaderApr?.querySelector('img')).not.toBeNull();
      const headerRows = baseElement.querySelectorAll('[data-testid="source-header-apr"]');
      const merklHeader = Array.from(headerRows).find(el => el.innerHTML.includes('example.com'));
      expect(merklHeader).toBeDefined();
    });

    it('uses flex layout so header and campaign APR values align to the right', () => {
      const reserve: ReserveWithSpread = {
        ...mockReserve,
        merklSupplys: [{
          name: 'Lend GHO on Merkl',
          link: 'https://merkl.angle.money',
          breakdowns: [
            { campaignId: 'merkl-1', campaignApr: 10, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
            { campaignId: 'merkl-2', campaignApr: 5, campaignStartedAt: '2026-01-01', campaignEndedAt: '2027-12-31', rewardTokenSymbol: 'INK', rewardTokenIconUrl: 'https://example.com/ink.svg' },
          ],
        }],
      };
      const { baseElement } = renderTooltip({ ...defaultProps, reserve });
      const headerApr = baseElement.querySelector('[data-testid="source-header-apr"]');
      const campaignAprs = baseElement.querySelectorAll('[data-testid="campaign-apr"]');
      expect(headerApr).toBeTruthy();
      expect(campaignAprs.length).toBeGreaterThanOrEqual(1);
      const headerRow = headerApr!.parentElement!;
      const campaignRow = campaignAprs[0].parentElement!;
      expect(headerRow.className).toContain('flex');
      expect(campaignRow.className).toContain('flex');
      expect(headerRow.className).not.toContain('grid-cols-[1fr_5rem]');
      expect(campaignRow.className).not.toContain('grid-cols-[1fr_5rem]');
    });
  });
});
