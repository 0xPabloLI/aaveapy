import { describe, expect, it } from 'vitest';

import { extractCapWarnings, type PortfolioCapWarning, type ProtocolCapWarning, type IncentiveCapWarning } from './portfolioCapWarnings';
import type { RateSimulationComputedResult, SimulationCampaignDetail } from './rateSimulationCalculator';

const makeSimResult = (overrides?: Partial<RateSimulationComputedResult>): RateSimulationComputedResult => ({
  tokenPrice: 1,
  supply: {
    hasInput: true,
    inputAmount: 1000,
    inputUsd: 1000,
    currentNative: 3,
    currentIncentive: 5,
    headlineIncentive: 5,
    currentTotal: 8,
    afterNative: 2.5,
    afterIncentive: 4,
    afterTotal: 6.5,
    deltaNative: -0.5,
    deltaIncentive: -1,
    deltaTotal: -1.5,
    sources: { protocol: { current: 3, after: 2.5, delta: -0.5 }, merit: { current: 0, after: 0, delta: 0 }, merkl: { current: 0, after: 0, delta: 0 }, brevis: { current: 5, after: 4, delta: -1, campaigns: [] } },
  },
  borrow: {
    hasInput: true,
    inputAmount: 500,
    inputUsd: 500,
    currentNative: 5,
    currentIncentive: 0,
    headlineIncentive: 0,
    currentTotal: 5,
    afterNative: 5,
    afterIncentive: 0,
    afterTotal: 5,
    deltaNative: 0,
    deltaIncentive: 0,
    deltaTotal: 0,
    sources: { protocol: { current: 5, after: 5, delta: 0 }, merit: { current: 0, after: 0, delta: 0 }, merkl: { current: 0, after: 0, delta: 0 }, brevis: { current: 0, after: 0, delta: 0 } },
  },
  spread: { current: -2, after: -2.5, delta: -0.5, usesCurrentSide: null },
  utilization: { current: 0.8, after: 0.85, delta: 0.05, optimal: 0.9 },
  marketMetrics: {
    availableLiquidityUsd: 10000,
    availableLiquidityUsdAfter: 9000,
    availableLiquidityUsdDelta: -1000,
    totalBorrowedUsd: 8000,
    totalBorrowedUsdAfter: 8500,
    totalBorrowedUsdDelta: 500,
    supplyCapUsd: 20000,
    borrowCapUsd: 15000,
    protocolFee: 10,
    optimalUtilization: 0.9,
    availableSupplyRoomUsd: 12000,
    supplyCapExceeded: false,
    supplyCapExceededByUsd: null,
    availableBorrowRoomUsd: 7000,
    borrowCapExceeded: false,
    borrowCapExceededByUsd: null,
    borrowLimitedByLiquidity: false,
  },
  forecastUnavailableCampaignCount: 0,
  forecastUnavailableCampaignIds: [],
  ...overrides,
});

describe('extractCapWarnings', () => {
  it('returns empty array when no simulation result exists', () => {
    expect(extractCapWarnings('r1', 'supply', undefined, [])).toEqual([]);
  });

  it('returns empty array when no caps are exceeded', () => {
    const result = makeSimResult();
    expect(extractCapWarnings('r1', 'supply', result, [])).toEqual([]);
  });

  it('returns ProtocolCapWarning when supply cap is exceeded', () => {
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        supplyCapExceeded: true,
        supplyCapExceededByUsd: 500,
        availableSupplyRoomUsd: 11500,
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('protocol_cap');
    const pw = warnings[0] as ProtocolCapWarning;
    expect(pw.side).toBe('supply');
    expect(pw.exceededByUsd).toBe(500);
    expect(pw.adjustToUsd).toBe(11500);
  });

  it('returns ProtocolCapWarning when borrow cap is exceeded', () => {
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        borrowCapExceeded: true,
        borrowCapExceededByUsd: 300,
        availableBorrowRoomUsd: 4700,
      },
    });
    const warnings = extractCapWarnings('r1', 'borrow', result, []);
    expect(warnings).toHaveLength(1);
    const pw = warnings[0] as ProtocolCapWarning;
    expect(pw.kind).toBe('protocol_cap');
    expect(pw.side).toBe('borrow');
    expect(pw.exceededByUsd).toBe(300);
    expect(pw.adjustToUsd).toBe(4700);
  });

  it('sets limitedByLiquidity=true when borrowLimitedByLiquidity is true', () => {
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        borrowCapExceeded: true,
        borrowCapExceededByUsd: 300,
        availableBorrowRoomUsd: 4700,
        borrowLimitedByLiquidity: true,
      },
    });
    const warnings = extractCapWarnings('r1', 'borrow', result, []);
    const pw = warnings[0] as ProtocolCapWarning;
    expect(pw.limitedByLiquidity).toBe(true);
  });

  it('sets limitedByLiquidity=undefined when borrowLimitedByLiquidity is false', () => {
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        borrowCapExceeded: true,
        borrowCapExceededByUsd: 300,
        availableBorrowRoomUsd: 4700,
        borrowLimitedByLiquidity: false,
      },
    });
    const warnings = extractCapWarnings('r1', 'borrow', result, []);
    const pw = warnings[0] as ProtocolCapWarning;
    expect(pw.limitedByLiquidity).toBeUndefined();
  });

  it('sets limitedByLiquidity=undefined by default for supply cap', () => {
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        supplyCapExceeded: true,
        supplyCapExceededByUsd: 500,
        availableSupplyRoomUsd: 11500,
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    const pw = warnings[0] as ProtocolCapWarning;
    expect(pw.limitedByLiquidity).toBeUndefined();
  });

  it('returns IncentiveCapWarning for Brevis position cap', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: 'Incentive on first $1,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000 },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
        },
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    const icw = warnings.find(w => w.kind === 'incentive_cap') as IncentiveCapWarning;
    expect(icw).toBeDefined();
    expect(icw.source).toBe('brevis');
    expect(icw.capUsd).toBe(1000);
    expect(icw.adjustToUsd).toBe(1000);
  });

  it('returns IncentiveCapWarning for Merit position cap', () => {
    const meritCampaign: SimulationCampaignDetail = {
      id: 'merit-0-self',
      label: 'Self',
      current: 2,
      after: 1,
      delta: -1,
      capNote: 'Incentive on first $2,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 2000 },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          merit: { current: 2, after: 1, delta: -1, campaigns: [meritCampaign] },
        },
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    const icw = warnings.find(w => w.kind === 'incentive_cap') as IncentiveCapWarning;
    expect(icw).toBeDefined();
    expect(icw.source).toBe('merit');
    expect(icw.capUsd).toBe(2000);
  });

  it('handles Brevis shared supply+borrow cap: adjustToUsd subtracts other side', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: 'Incentive on first $5,000.00 · supply + borrow',
      capWarning: true,
      capMetrics: { positionCapUsd: 5000, isSharedSupplyBorrow: true },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        inputUsd: 4000,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
        },
      },
    });
    const entries = [{ reserveId: 'r1', borrowAmountUsd: 2000 }];
    const warnings = extractCapWarnings('r1', 'supply', result, entries);
    const icw = warnings.find(w => w.kind === 'incentive_cap') as IncentiveCapWarning;
    expect(icw).toBeDefined();
    expect(icw.adjustToUsd).toBe(3000); // 5000 - 2000 borrow
    expect(icw.isSharedSupplyBorrow).toBe(true);
  });

  it('orders warnings: protocol cap before incentive cap', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: 'Incentive on first $1,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000 },
    };
    const result = makeSimResult({
      marketMetrics: {
        ...makeSimResult().marketMetrics,
        supplyCapExceeded: true,
        supplyCapExceededByUsd: 500,
        availableSupplyRoomUsd: 11500,
      },
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
        },
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    expect(warnings).toHaveLength(2);
    expect(warnings[0].kind).toBe('protocol_cap');
    expect(warnings[1].kind).toBe('incentive_cap');
  });

  it('skips incentive cap campaigns without capWarning', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 4,
      delta: -1,
      capNote: 'Incentive on first $10,000.00',
      capWarning: false,
      capMetrics: { positionCapUsd: 10000 },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 4, delta: -1, campaigns: [brevisCampaign] },
        },
      },
    });
    expect(extractCapWarnings('r1', 'supply', result, [])).toEqual([]);
  });

  it('skips incentive cap campaigns without capMetrics', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: '~60d to end',
      capWarning: false,
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
        },
      },
    });
    expect(extractCapWarnings('r1', 'supply', result, [])).toEqual([]);
  });

  it('deduplicates same-source incentive caps (uses first binding)', () => {
    const c1: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis A',
      current: 3,
      after: 2,
      delta: -1,
      capNote: 'Incentive on first $1,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000 },
    };
    const c2: SimulationCampaignDetail = {
      id: 'brevis-1-b2',
      label: 'Brevis B',
      current: 2,
      after: 1,
      delta: -1,
      capNote: 'Incentive on first $2,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 2000 },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [c1, c2] },
        },
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    const icws = warnings.filter(w => w.kind === 'incentive_cap') as IncentiveCapWarning[];
    expect(icws).toHaveLength(1);
    expect(icws[0].source).toBe('brevis');
    expect(icws[0].capUsd).toBe(1000);
  });

  it('returns separate Brevis and Merit incentive caps', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: 'Incentive on first $1,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000 },
    };
    const meritCampaign: SimulationCampaignDetail = {
      id: 'merit-0-self',
      label: 'Self',
      current: 2,
      after: 1,
      delta: -1,
      capNote: 'Incentive on first $2,000.00',
      capWarning: true,
      capMetrics: { positionCapUsd: 2000 },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
          merit: { current: 2, after: 1, delta: -1, campaigns: [meritCampaign] },
        },
      },
    });
    const warnings = extractCapWarnings('r1', 'supply', result, []);
    const icws = warnings.filter(w => w.kind === 'incentive_cap') as IncentiveCapWarning[];
    expect(icws).toHaveLength(2);
    expect(icws[0].source).toBe('brevis');
    expect(icws[1].source).toBe('merit');
  });

  it('handles shared cap when other side exceeds cap (adjustToUsd = 0)', () => {
    const brevisCampaign: SimulationCampaignDetail = {
      id: 'brevis-0-b1',
      label: 'Brevis',
      current: 5,
      after: 3,
      delta: -2,
      capNote: 'Incentive on first $1,000.00 · supply + borrow',
      capWarning: true,
      capMetrics: { positionCapUsd: 1000, isSharedSupplyBorrow: true },
    };
    const result = makeSimResult({
      supply: {
        ...makeSimResult().supply,
        sources: {
          ...makeSimResult().supply.sources,
          brevis: { current: 5, after: 3, delta: -2, campaigns: [brevisCampaign] },
        },
      },
    });
    const entries = [{ reserveId: 'r1', borrowAmountUsd: 1500 }];
    const warnings = extractCapWarnings('r1', 'supply', result, entries);
    const icw = warnings.find(w => w.kind === 'incentive_cap') as IncentiveCapWarning;
    expect(icw.adjustToUsd).toBe(0);
  });
});
