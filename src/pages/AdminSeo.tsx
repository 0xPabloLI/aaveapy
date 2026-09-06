import { useMemo, useState } from "react";
import { useGscRows, useSemrushRows, useSemrushDeleteMutation } from "@/hooks/useSeoData";
import { SEO_COUNTRIES, countryFromAlpha3, countryFromSemrush } from "@/lib/seoCountries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw, AlertCircle, LogOut } from "lucide-react";
import { Helmet } from "react-helmet-async";
import SeoDashboardGate from "@/components/admin/SeoDashboardGate";
import LocalizedPagesPanel from "@/components/admin/LocalizedPagesPanel";
import { formatPercent, formatReserveSizeToken, formatUsd } from "@/lib/formatters";

type RangePreset = "7d" | "28d" | "90d";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: RangePreset): { from: string; to: string } {
  // GSC has ~2-3 day lag; use day-3 as "to".
  const to = isoDaysAgo(3);
  const map: Record<RangePreset, number> = { "7d": 7, "28d": 28, "90d": 90 };
  const from = isoDaysAgo(3 + map[preset]);
  return { from, to };
}

function fmtPct(n: number) {
  return formatPercent(n * 100);
}

function fmtPos(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(1);
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return formatReserveSizeToken(n);
}

function fmtUsd(n: number | null | undefined) {
  if (n == null) return "—";
  return formatUsd(n);
}

const EMPTY_ROWS: never[] = [];

const AdminSeoInner = ({ onSignOut }: { onSignOut: () => void }) => {
  const [preset, setPreset] = useState<RangePreset>("28d");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(SEO_COUNTRIES.map((c) => c.alpha3)),
  );
  const [keywordFilter, setKeywordFilter] = useState("");

  const range = useMemo(() => presetRange(preset), [preset]);
  const countryAlpha3 = useMemo(() => Array.from(selectedCountries), [selectedCountries]);
  const countrySemrush = useMemo(
    () =>
      Array.from(selectedCountries)
        .map((a3) => countryFromAlpha3(a3)?.semrush)
        .filter((x): x is string => !!x),
    [selectedCountries],
  );

  const gscQuery = useGscRows({
    from: range.from,
    to: range.to,
    country: countryAlpha3.length > 0 ? countryAlpha3 : undefined,
    groupBy: ["country", "page", "query"],
  });

  const semrushQuery = useSemrushRows({
    country: countrySemrush.length > 0 ? countrySemrush : undefined,
    keyword: keywordFilter.trim() || undefined,
  });

  const deleteSemrushMut = useSemrushDeleteMutation();

  const toggleCountry = (alpha3: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(alpha3)) next.delete(alpha3);
      else next.add(alpha3);
      return next;
    });
  };

  const gscRows = gscQuery.data?.rows ?? EMPTY_ROWS;
  const semrushRows = semrushQuery.data?.rows ?? [];

  // Country-level GSC aggregates
  const countryAgg = useMemo(() => {
    const map = new Map<string, { clicks: number; impressions: number; positions: number[] }>();
    for (const row of gscRows) {
      const c = row.country.toLowerCase();
      const agg = map.get(c) ?? { clicks: 0, impressions: 0, positions: [] };
      agg.clicks += row.clicks;
      agg.impressions += row.impressions;
      if (row.position > 0) agg.positions.push(row.position);
      map.set(c, agg);
    }
    return Array.from(map.entries())
      .map(([country, v]) => ({
        country,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        avgPosition:
          v.positions.length > 0
            ? v.positions.reduce((a, b) => a + b, 0) / v.positions.length
            : null,
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [gscRows]);

  return (
    <>
      <Helmet>
        <title>SEO Dashboard · AaveAPY Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="ds-text-24 font-semibold gradient-text">SEO Dashboard</h1>
              <p className="ds-text-13 text-muted-foreground mt-1">
                GSC daily aggregates and Semrush seed data. Admin only — not indexed.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </header>

          {/* Filter bar */}
          <div className="bg-card border border-border/60 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              {(["7d", "28d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`ds-text-12 px-2.5 py-1 rounded-md transition ${
                    preset === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:ring-2 hover:ring-border"
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="ds-text-11 text-muted-foreground ml-2 tabular-nums">
                {range.from} → {range.to}
              </span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            <div className="flex flex-wrap gap-1.5">
              {SEO_COUNTRIES.map((c) => {
                const active = selectedCountries.has(c.alpha3);
                return (
                  <button
                    key={c.alpha3}
                    onClick={() => toggleCountry(c.alpha3)}
                    className={`ds-text-12 px-2 py-1 rounded-md transition inline-flex items-center gap-1 ${
                      active
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/40"
                        : "bg-muted/30 text-muted-foreground hover:ring-2 hover:ring-border"
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-px bg-border/60" />

            <Input
              placeholder="Filter keyword…"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="ds-text-13 h-8 w-48"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                gscQuery.refetch();
                semrushQuery.refetch();
              }}
              className="ml-auto h-8"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>

          {/* Localized page scoreboard */}
          {gscQuery.isLoading ? (
            <Skeleton className="h-40 w-full mb-8" />
          ) : (
            <LocalizedPagesPanel rows={gscRows} />
          )}

          {/* GSC section */}
          <section className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="ds-text-16 font-semibold">Google Search Console</h2>
              <span className="ds-text-11 text-muted-foreground tabular-nums">
                {gscQuery.data
                  ? `${gscQuery.data.total.toLocaleString()} rows`
                  : gscQuery.isLoading
                    ? "loading…"
                    : ""}
              </span>
            </div>

            {gscQuery.error ? (
              <ErrorCard error={gscQuery.error} />
            ) : gscQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {/* Country cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  {countryAgg.map((row) => {
                    const c = countryFromAlpha3(row.country);
                    return (
                      <div
                        key={row.country}
                        className="bg-card border border-border/60 rounded-xl p-3"
                      >
                        <div className="ds-text-12 text-muted-foreground flex items-center gap-1 mb-1">
                          <span>{c?.flag ?? "🏳️"}</span>
                          <span>{c?.label ?? row.country.toUpperCase()}</span>
                        </div>
                        <div className="ds-text-20 font-semibold tabular-nums">
                          {row.clicks.toLocaleString()}
                        </div>
                        <div className="ds-text-11 text-muted-foreground tabular-nums">
                          {row.impressions.toLocaleString()} impr · {fmtPct(row.ctr)} ·
                          pos {fmtPos(row.avgPosition)}
                        </div>
                      </div>
                    );
                  })}
                  {countryAgg.length === 0 && (
                    <div className="col-span-full bg-card border border-border/60 rounded-xl p-6 text-center ds-text-13 text-muted-foreground">
                      No GSC data for the selected range yet. The cron usually has ~3 days of lag.
                    </div>
                  )}
                </div>

                {/* Top query rows */}
                <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full ds-text-13">
                      <thead className="bg-muted/30 text-muted-foreground ds-text-11">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Country</th>
                          <th className="text-left px-3 py-2 font-medium">Page</th>
                          <th className="text-left px-3 py-2 font-medium">Query</th>
                          <th className="text-right px-3 py-2 font-medium">Clicks</th>
                          <th className="text-right px-3 py-2 font-medium">Impr</th>
                          <th className="text-right px-3 py-2 font-medium">CTR</th>
                          <th className="text-right px-3 py-2 font-medium">Pos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gscRows
                          .slice()
                          .sort((a, b) => b.clicks - a.clicks)
                          .slice(0, 100)
                          .map((row, i) => {
                            const c = countryFromAlpha3(row.country);
                            return (
                              <tr
                                key={`${row.date}-${row.country}-${row.page}-${row.query}-${i}`}
                                className="border-t border-border/40 hover:bg-muted/20"
                              >
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center gap-1">
                                    <span>{c?.flag ?? "🏳️"}</span>
                                    <span className="ds-text-12">{c?.label ?? row.country}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2 ds-text-12 text-muted-foreground truncate max-w-[200px]">
                                  {row.page.replace(/^https?:\/\/[^/]+/, "")}
                                </td>
                                <td className="px-3 py-2">{row.query || <em className="text-muted-foreground">(no query)</em>}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {row.clicks.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {row.impressions.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmtPct(row.ctr)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmtPos(row.position)}
                                </td>
                              </tr>
                            );
                          })}
                        {gscRows.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                              No rows.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {gscRows.length > 100 && (
                    <div className="ds-text-11 text-muted-foreground px-3 py-2 border-t border-border/40 bg-muted/20">
                      Showing top 100 of {gscRows.length.toLocaleString()} rows.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Semrush section */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="ds-text-16 font-semibold">Semrush seed snapshots</h2>
              <span className="ds-text-11 text-muted-foreground tabular-nums">
                {semrushQuery.data ? `${semrushRows.length} rows` : ""}
              </span>
            </div>

            {semrushQuery.error ? (
              <ErrorCard error={semrushQuery.error} />
            ) : semrushQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full ds-text-13">
                    <thead className="bg-muted/30 text-muted-foreground ds-text-11">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Date</th>
                        <th className="text-left px-3 py-2 font-medium">Country</th>
                        <th className="text-left px-3 py-2 font-medium">Keyword</th>
                        <th className="text-right px-3 py-2 font-medium">Volume</th>
                        <th className="text-right px-3 py-2 font-medium">Pos</th>
                        <th className="text-right px-3 py-2 font-medium">CPC</th>
                        <th className="text-right px-3 py-2 font-medium">KDI</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {semrushRows.map((row) => {
                        const c = countryFromSemrush(row.country);
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-border/40 hover:bg-muted/20"
                          >
                            <td className="px-3 py-2 ds-text-12 text-muted-foreground tabular-nums">
                              {row.snapshot_date}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1">
                                <span>{c?.flag ?? "🏳️"}</span>
                                <span className="ds-text-12">{c?.label ?? row.country.toUpperCase()}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2">{row.keyword}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtNum(row.volume)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtPos(row.position)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtUsd(row.cpc_usd)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtNum(row.difficulty)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${row.keyword}" (${row.country})?`)) {
                                    deleteSemrushMut.mutate(row.id);
                                  }
                                }}
                                disabled={deleteSemrushMut.isPending}
                                className="text-muted-foreground hover:text-destructive transition p-1 rounded hover:ring-2 hover:ring-border"
                                aria-label="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {semrushRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                            No Semrush rows. Seed via{" "}
                            <code className="ds-text-11 bg-muted/40 px-1 rounded">
                              POST /api/seo/semrush
                            </code>{" "}
                            (see m3 spec §6.2).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

function ErrorCard({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;
  return (
    <div className="bg-card border border-destructive/40 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="ds-text-13">
        <div className="font-medium text-destructive">
          Request failed{status ? ` (${status})` : ""}
        </div>
        <div className="ds-text-12 text-muted-foreground mt-0.5">{msg}</div>
        {status === 503 && (
          <div className="ds-text-11 text-muted-foreground mt-2">
            Backend likely hasn't deployed M3 yet, or <code>SEO_ADMIN_TOKEN</code> isn't
            configured on Railway.
          </div>
        )}
      </div>
    </div>
  );
}

const AdminSeo = () => (
  <SeoDashboardGate>
    {(signOut) => <AdminSeoInner onSignOut={signOut} />}
  </SeoDashboardGate>
);

export default AdminSeo;
