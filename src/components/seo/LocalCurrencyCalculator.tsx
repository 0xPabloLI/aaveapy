import { useMemo, useState } from 'react';
import { useAaveMarkets } from '@/hooks/useAaveMarkets';
import { useUsdRate } from '@/lib/fxRates';
import { parseLocaleNumber } from '@/lib/parseLocaleNumber';

const STABLE_SYMBOLS = new Set([
  'USDC',
  'USDC.E',
  'USDT',
  'USDT0',
  'DAI',
  'USDS',
  'GHO',
  'FDUSD',
  'PYUSD',
  'USDE',
  'RLUSD',
]);

export interface CalculatorCopy {
  /** Anchor id for the section heading. */
  id: string;
  h2: string;
  intro: string;
  /** BCP-47 locale used for number formatting, e.g. "pt-BR". */
  numberLocale: string;
  /** ISO-4217 code, e.g. "BRL". */
  currency: string;
  /** Pre-filled amount in the local currency. */
  defaultAmount: number;
  amountLabel: string;
  reserveLabel: string;
  apyLabel: string;
  perYear: string;
  perMonth: string;
  perDay: string;
  /** Prefix for the USD equivalent line, e.g. "≈ em dólar:". */
  usdEquivalentLabel: string;
  loading: string;
  error: string;
  disclaimer: string;
}

interface StableOption {
  key: string;
  label: string;
  apy: number;
}

export function LocalCurrencyCalculator({ copy }: { copy: CalculatorCopy }) {
  const { data, isLoading, isError } = useAaveMarkets();
  const { data: fx } = useUsdRate(copy.currency);
  const [amount, setAmount] = useState(String(copy.defaultAmount));
  const [selected, setSelected] = useState<string>('');

  const options = useMemo<StableOption[]>(() => {
    const reserves = data?.reserves ?? [];
    const shortlist = reserves
      .filter(
        (r) =>
          STABLE_SYMBOLS.has(r.tokenSymbol?.toUpperCase() ?? '') &&
          typeof r.supplyApy === 'number' &&
          r.supplyApy > 0 &&
          !r.supplyDisabled &&
          !r.isFrozen &&
          !r.isPaused,
      )
      .sort((a, b) => (b.supplyApy ?? 0) - (a.supplyApy ?? 0))
      .slice(0, 8);

    // The same symbol can exist on one chain across several markets (Horizon, V4 Bluechip…);
    // append a readable market suffix only where the short label would be ambiguous.
    const seen = new Map<string, number>();
    shortlist.forEach((r) => {
      const short = `${r.tokenSymbol} · ${r.chainName}`;
      seen.set(short, (seen.get(short) ?? 0) + 1);
    });

    return shortlist.map((r) => {
      const short = `${r.tokenSymbol} · ${r.chainName}`;
      const suffix = (r.marketName ?? '')
        .replace(/^Aave/i, '')
        .replace(new RegExp(r.chainName ?? '', 'i'), '')
        .trim();
      return {
        key: r.reserveId,
        label: (seen.get(short) ?? 0) > 1 && suffix ? `${short} (${suffix})` : short,
        apy: r.supplyApy as number,
      };
    });
  }, [data]);

  const active = options.find((o) => o.key === selected) ?? options[0];

  const money = useMemo(
    () =>
      new Intl.NumberFormat(copy.numberLocale, {
        style: 'currency',
        currency: copy.currency,
        maximumFractionDigits: 2,
      }),
    [copy.numberLocale, copy.currency],
  );
  const usdMoney = useMemo(
    () =>
      new Intl.NumberFormat(copy.numberLocale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [copy.numberLocale],
  );
  const percent = useMemo(
    () =>
      new Intl.NumberFormat(copy.numberLocale, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [copy.numberLocale],
  );

  const parsedAmount = parseLocaleNumber(amount, copy.numberLocale);
  const principal = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const apy = active?.apy ?? 0;
  const perYear = (principal * apy) / 100;

  return (
    <section aria-labelledby={copy.id} className="mt-10">
      <h2 id={copy.id} className="text-xl font-semibold mb-3">
        {copy.h2}
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-4">{copy.intro}</p>

      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
        {isLoading && <p className="text-sm text-muted-foreground">{copy.loading}</p>}
        {isError && !options.length && <p className="text-sm text-muted-foreground">{copy.error}</p>}

        {!!options.length && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">{copy.amountLabel}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-base tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">{copy.reserveLabel}</span>
                <select
                  value={active?.key ?? ''}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label} — {percent.format(o.apy / 100)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 p-3">
                <dt className="text-xs text-muted-foreground">{copy.apyLabel}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {percent.format(apy / 100)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <dt className="text-xs text-muted-foreground">{copy.perYear}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {money.format(perYear)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <dt className="text-xs text-muted-foreground">{copy.perMonth}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {money.format(perYear / 12)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <dt className="text-xs text-muted-foreground">{copy.perDay}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {money.format(perYear / 365)}
                </dd>
              </div>
            </dl>

            {fx?.rate && principal > 0 && (
              <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                {copy.usdEquivalentLabel} {usdMoney.format(principal / fx.rate)}
              </p>
            )}

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{copy.disclaimer}</p>
          </>
        )}
      </div>
    </section>
  );
}
