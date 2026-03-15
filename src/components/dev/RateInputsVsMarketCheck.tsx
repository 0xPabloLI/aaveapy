/**
 * Temporary dev-only check: compare native rates computed from reserve
 * rate-data with supplyApy/borrowApy from /markets. Renders a collapsible panel with
 * mismatches (or "OK") when both APIs are loaded. Also shows logoURI for
 * first reserve (path 1: tokenlist/address-book).
 */
import React, { useState, useMemo } from 'react';
import { useAaveMarkets } from '@/hooks/useAaveMarkets';
import { simulateNativeRatesAfterActions, hasRateCalcFields } from '@/lib/interestRateCalculator';
import type { NativeRateSimulation } from '@/lib/interestRateCalculator';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import type { ReserveWithSpread } from '@/types/aave';

const TOLERANCE_PCT = 0.02;

interface Mismatch {
  reserve: ReserveWithSpread;
  simulated: NativeRateSimulation;
  marketSupplyApy: number | undefined;
  marketBorrowApy: number | undefined;
  marketUtilization: number | undefined;
  rateSupplyApy: number;
  rateBorrowApy: number;
  rateUtilization: number;
  supplyDiff: number;
  borrowDiff: number;
  utilizationDiff: number;
  totalDebt: string;
  totalLiquidity: string;
}

function useRateInputsVsMarketResult(): {
  mismatches: Mismatch[];
  totalReserves: number;
  withRateInput: number;
  loading: boolean;
} {
  const { data: marketsData, isLoading: marketsLoading } = useAaveMarkets();

  return useMemo(() => {
    const reserves = marketsData?.reserves ?? [];
    if (marketsLoading) {
      return { mismatches: [], totalReserves: reserves.length, withRateInput: 0, loading: true };
    }

    const mismatches: Mismatch[] = [];
    let withRateInput = 0;
    for (const reserve of reserves) {
      if (!hasRateCalcFields(reserve)) continue;
      withRateInput += 1;
      const simulated = simulateNativeRatesAfterActions(reserve, {
        supplyAmount: '0',
        borrowAmount: '0',
      });
      const marketSupply = reserve.supplyApy ?? undefined;
      const marketBorrow = reserve.borrowApy ?? undefined;
      const marketUtilization = reserve.utilizationPct ?? undefined;
      const rateUtilization = simulated.utilizationRatePercent;
      const supplyDiff =
        marketSupply != null
          ? Math.abs(simulated.supplyApyPercent - marketSupply)
          : 0;
      const borrowDiff =
        marketBorrow != null
          ? Math.abs(simulated.borrowApyPercent - marketBorrow)
          : 0;
      const utilizationDiff =
        marketUtilization != null
          ? Math.abs(rateUtilization - marketUtilization)
          : 0;
      if (supplyDiff > TOLERANCE_PCT || borrowDiff > TOLERANCE_PCT) {
        const totalDebt = reserve.totalVariableDebt!;
        const totalLiquidity = (BigInt(reserve.availableLiquidity!) + BigInt(totalDebt)).toString();
        mismatches.push({
          reserve,
          simulated,
          marketSupplyApy: marketSupply,
          marketBorrowApy: marketBorrow,
          marketUtilization,
          rateSupplyApy: simulated.supplyApyPercent,
          rateBorrowApy: simulated.borrowApyPercent,
          rateUtilization,
          supplyDiff,
          borrowDiff,
          utilizationDiff,
          totalDebt,
          totalLiquidity,
        });
      }
    }
    return {
      mismatches,
      totalReserves: reserves.length,
      withRateInput,
      loading: false,
    };
  }, [marketsData?.reserves, marketsLoading]);
}

export function RateInputsVsMarketCheck() {
  const [open, setOpen] = useState(false);
  const { data: marketsData } = useAaveMarkets();
  const { mismatches, totalReserves, withRateInput, loading } = useRateInputsVsMarketResult();

  const acredLogoUri = useMemo(() => {
    const reserves = marketsData?.reserves ?? [];
    const acred = reserves.find((r) => r.tokenSymbol.toUpperCase() === 'ACRED');
    if (!acred) return null;
    const { logoURI } = fetchIconSymbolAndName({
      underlyingAsset: acred.tokenAddress,
      symbol: acred.tokenSymbol,
      name: acred.tokenName,
    });
    return { symbol: acred.tokenSymbol, logoURI: logoURI ?? undefined };
  }, [marketsData?.reserves]);

  return (
    <div className="border border-amber-200 bg-amber-50/80 rounded-lg text-left text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between font-medium text-amber-900"
      >
        <span>
          Rate vs Market check: {loading ? '…' : mismatches.length === 0 ? 'OK' : `${mismatches.length} mismatch(es)`}
        </span>
        <span className="text-amber-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-amber-900/90">
          <p className="mb-2">
            Reserves: {totalReserves} total, {withRateInput} with rate-data. Tolerance: ±{TOLERANCE_PCT}%
          </p>
          {acredLogoUri !== null ? (
            <p className="mb-2 ds-text-11">
              LogoURI (path 1) for ACRED:{' '}
              {acredLogoUri.logoURI ? (
                <a href={acredLogoUri.logoURI} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {acredLogoUri.logoURI}
                </a>
              ) : (
                <span className="text-amber-700">not set (will use local or CoinGecko)</span>
              )}
            </p>
          ) : (
            <p className="mb-2 ds-text-11 text-amber-700">ACRED not found in current reserves.</p>
          )}
          {mismatches.length === 0 ? (
            <p className="text-green-700">Supply/borrow APY from rate-data match market snapshot.</p>
          ) : (
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-amber-50">
                  <tr className="border-b border-amber-200">
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Chain</th>
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Market</th>
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Token</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Util (M)</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Util (R)</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Supply (M)</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Supply (R)</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Δ Supply</th>
                    <th className="text-right py-1 pr-2 whitespace-nowrap">Borrow (M)</th>
                    <th className="text-right py-1 whitespace-nowrap">Borrow (R)</th>
                    <th className="text-right py-1 whitespace-nowrap">Δ Borrow</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m) => {
                    const fmtBigNum = (val: string) => {
                      const n = BigInt(val);
                      if (n === 0n) return '0';
                      const str = n.toString();
                      return str.length > 12 ? `${str.slice(0, 6)}…e${str.length - 1}` : str;
                    };
                    const rowKey = `${m.reserve.chainId}-${m.reserve.marketName}-${m.reserve.tokenAddress}`;
                    return (
                      <React.Fragment key={rowKey}>
                        <tr className="border-b border-amber-100">
                          <td className="py-1 pr-2 whitespace-nowrap" title={`chainId: ${m.reserve.chainId}`}>{m.reserve.chainName}</td>
                          <td className="py-1 pr-2 whitespace-nowrap font-medium">{m.reserve.marketName}</td>
                          <td className="py-1 pr-2 whitespace-nowrap font-medium" title={m.reserve.tokenAddress}>{m.reserve.tokenSymbol}</td>
                          <td className="text-right tabular-nums py-1 pr-2">{m.marketUtilization?.toFixed(2) ?? '—'}%</td>
                          <td className="text-right tabular-nums py-1 pr-2">{m.rateUtilization.toFixed(2)}%</td>
                          <td className="text-right tabular-nums py-1 pr-2">{m.marketSupplyApy?.toFixed(2) ?? '—'}%</td>
                          <td className="text-right tabular-nums py-1 pr-2">{m.rateSupplyApy.toFixed(2)}%</td>
                          <td className={`text-right tabular-nums py-1 pr-2 ${m.supplyDiff > TOLERANCE_PCT ? 'text-rose-600 font-medium' : ''}`}>
                            {m.supplyDiff > 0 ? '+' : ''}{m.supplyDiff.toFixed(2)}%
                          </td>
                          <td className="text-right tabular-nums py-1 pr-2">{m.marketBorrowApy?.toFixed(2) ?? '—'}%</td>
                          <td className="text-right tabular-nums py-1">{m.rateBorrowApy.toFixed(2)}%</td>
                          <td className={`text-right tabular-nums py-1 ${m.borrowDiff > TOLERANCE_PCT ? 'text-rose-600 font-medium' : ''}`}>
                            {m.borrowDiff > 0 ? '+' : ''}{m.borrowDiff.toFixed(2)}%
                          </td>
                        </tr>
                        <tr className="border-b border-amber-200 bg-amber-100/40">
                          <td colSpan={11} className="py-1 px-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-amber-800 font-mono">
                              <span title="token decimals">dec: {m.reserve.decimals}</span>
                              <span title="token price (USD)">price: ${m.reserve.tokenPrice?.toFixed(4) ?? '—'}</span>
                              <span title="reserve size (USD)">size: ${m.reserve.reserveSizeUsd?.toLocaleString() ?? '—'}</span>
                              <span title="supply cap (USD)">cap: ${m.reserve.supplyCapUsd?.toLocaleString() ?? '—'}</span>
                              <span title="deficit (raw)">deficit: {fmtBigNum(m.reserve.deficit!)}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-amber-800 font-mono mt-0.5">
                              <span title="availableLiquidity (raw)">avail: {fmtBigNum(m.reserve.availableLiquidity!)}</span>
                              <span title="totalVariableDebt (raw)">totalDebt: {fmtBigNum(m.reserve.totalVariableDebt!)}</span>
                              <span title="totalLiquidity = avail + totalDebt">totalLiq: {fmtBigNum(m.totalLiquidity)}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-amber-800 font-mono mt-0.5">
                              <span title="optimalUsageRate (ray → %)">optUtil: {(Number(m.reserve.optimalUsageRate) / 1e25).toFixed(1)}%</span>
                              <span title="reserveFactor (bps → %)">resFactor: {(Number(m.reserve.reserveFactor) / 100).toFixed(2)}%</span>
                              <span title="baseVariableBorrowRate (ray → %)">baseBorrow: {(Number(m.reserve.baseVariableBorrowRate) / 1e25).toFixed(2)}%</span>
                              <span title="variableRateSlope1 (ray → %)">slope1: {(Number(m.reserve.variableRateSlope1) / 1e25).toFixed(2)}%</span>
                              <span title="variableRateSlope2 (ray → %)">slope2: {(Number(m.reserve.variableRateSlope2) / 1e25).toFixed(2)}%</span>

                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
