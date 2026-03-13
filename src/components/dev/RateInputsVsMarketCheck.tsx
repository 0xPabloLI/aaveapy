/**
 * Temporary dev-only check: compare native rates computed from /rate-inputs
 * with supplyApy/borrowApy from /markets. Renders a collapsible panel with
 * mismatches (or "OK") when both APIs are loaded. Also shows logoURI for
 * first reserve (path 1: tokenlist/address-book).
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAaveMarkets } from '@/hooks/useAaveMarkets';
import {
  RATE_INPUTS_SNAPSHOT_QUERY_KEY,
  fetchRateInputsSnapshot,
  findReserveRateInput,
} from '@/hooks/useReserveRateInputs';
import { simulateNativeRatesAfterActions } from '@/lib/interestRateCalculator';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import type { ReserveWithSpread } from '@/types/aave';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getCachedRateInputsSnapshotEntry } from '@/lib/cache';

const TOLERANCE_PCT = 0.02;

interface Mismatch {
  reserve: ReserveWithSpread;
  marketSupplyApy: number | undefined;
  marketBorrowApy: number | undefined;
  rateSupplyApy: number;
  rateBorrowApy: number;
  supplyDiff: number;
  borrowDiff: number;
}

function useRateInputsVsMarketResult(): {
  mismatches: Mismatch[];
  totalReserves: number;
  withRateInput: number;
  loading: boolean;
} {
  const { data: marketsData, isLoading: marketsLoading } = useAaveMarkets();
  const cachedEntry = getCachedRateInputsSnapshotEntry();
  const staleTime = cachedEntry?.data?.staleTimeMs ?? QUERY_STALE_TIMES.coreSnapshotApi;
  const rateInputsQuery = useQuery({
    queryKey: RATE_INPUTS_SNAPSHOT_QUERY_KEY,
    queryFn: fetchRateInputsSnapshot,
    staleTime,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });

  return useMemo(() => {
    const reserves = marketsData?.reserves ?? [];
    const payload = rateInputsQuery.data;
    if (marketsLoading || rateInputsQuery.isPending || !payload) {
      return { mismatches: [], totalReserves: reserves.length, withRateInput: 0, loading: true };
    }

    const mismatches: Mismatch[] = [];
    let withRateInput = 0;
    for (const reserve of reserves) {
      const rateInput = findReserveRateInput(
        payload,
        reserve.chainId,
        reserve.tokenAddress,
        reserve.marketName
      );
      if (!rateInput) continue;
      withRateInput += 1;
      const simulated = simulateNativeRatesAfterActions(rateInput, {
        supplyAmount: '0',
        borrowAmount: '0',
      });
      const marketSupply = reserve.supplyApy ?? undefined;
      const marketBorrow = reserve.borrowApy ?? undefined;
      const supplyDiff =
        marketSupply != null
          ? Math.abs(simulated.supplyApyPercent - marketSupply)
          : 0;
      const borrowDiff =
        marketBorrow != null
          ? Math.abs(simulated.borrowApyPercent - marketBorrow)
          : 0;
      if (supplyDiff > TOLERANCE_PCT || borrowDiff > TOLERANCE_PCT) {
        mismatches.push({
          reserve,
          marketSupplyApy: marketSupply,
          marketBorrowApy: marketBorrow,
          rateSupplyApy: simulated.supplyApyPercent,
          rateBorrowApy: simulated.borrowApyPercent,
          supplyDiff,
          borrowDiff,
        });
      }
    }
    return {
      mismatches,
      totalReserves: reserves.length,
      withRateInput,
      loading: false,
    };
  }, [marketsData?.reserves, rateInputsQuery.data, rateInputsQuery.isPending, marketsLoading]);
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
            Reserves: {totalReserves} total, {withRateInput} with rate-inputs. Tolerance: ±{TOLERANCE_PCT}%
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
            <p className="text-green-700">Supply/borrow APY from rate-inputs match market snapshot.</p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Chain</th>
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Market</th>
                    <th className="text-left py-1 pr-2 whitespace-nowrap">Token</th>
                    <th className="text-left py-1 pr-2 max-w-[6rem] truncate" title="Token contract address">Address</th>
                    <th className="text-right py-1 whitespace-nowrap">Market Supply</th>
                    <th className="text-right py-1 whitespace-nowrap">Rate Supply</th>
                    <th className="text-right py-1 whitespace-nowrap">Δ Supply</th>
                    <th className="text-right py-1 whitespace-nowrap">Market Borrow</th>
                    <th className="text-right py-1 whitespace-nowrap">Rate Borrow</th>
                    <th className="text-right py-1 whitespace-nowrap">Δ Borrow</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m) => (
                    <tr key={`${m.reserve.chainId}-${m.reserve.marketName}-${m.reserve.tokenAddress}`} className="border-b border-amber-100">
                      <td className="py-1 pr-2 whitespace-nowrap" title={`chainId: ${m.reserve.chainId}`}>{m.reserve.chainName}</td>
                      <td className="py-1 pr-2 whitespace-nowrap font-medium">{m.reserve.marketName}</td>
                      <td className="py-1 pr-2 whitespace-nowrap font-medium">{m.reserve.tokenSymbol}</td>
                      <td className="py-1 pr-2 max-w-[6rem] truncate font-mono text-[10px]" title={m.reserve.tokenAddress}>
                        {m.reserve.tokenAddress.slice(0, 6)}…{m.reserve.tokenAddress.slice(-4)}
                      </td>
                      <td className="text-right tabular-nums py-1">{m.marketSupplyApy?.toFixed(2) ?? '—'}</td>
                      <td className="text-right tabular-nums py-1">{m.rateSupplyApy.toFixed(2)}</td>
                      <td className="text-right tabular-nums text-rose-600 py-1">+{m.supplyDiff.toFixed(2)}%</td>
                      <td className="text-right tabular-nums py-1">{m.marketBorrowApy?.toFixed(2) ?? '—'}</td>
                      <td className="text-right tabular-nums py-1">{m.rateBorrowApy.toFixed(2)}</td>
                      <td className="text-right tabular-nums text-rose-600 py-1">+{m.borrowDiff.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
