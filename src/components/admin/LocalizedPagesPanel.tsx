import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import type { GscRow } from "@/lib/seoApi";
import { LOCALIZED_PAGES, gscInspectUrl, toPath } from "@/lib/localizedPages";
import { formatPercent } from "@/lib/formatters";

export interface PageEngagement {
  /** Average visible seconds on the page (from the `time_on_page` analytics event). */
  avgSeconds: number | null;
  /** Number of sessions the average is based on. */
  samples: number;
}

interface Props {
  rows: GscRow[];
  /** Optional engagement data keyed by page path. */
  engagement?: Record<string, PageEngagement>;
}

interface PageStat {
  path: string;
  locale: string;
  flag: string;
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
  queries: number;
}

function fmtPos(n: number | null) {
  return n == null ? "—" : n.toFixed(1);
}

function fmtSeconds(s: number | null) {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function statusOf(stat: PageStat): { label: string; className: string } {
  if (stat.clicks > 0)
    return { label: "Indexed · ranking", className: "text-emerald-600 ring-emerald-500/30 bg-emerald-500/10" };
  if (stat.impressions > 0)
    return { label: "Indexed · no clicks", className: "text-secondary ring-border bg-muted/40" };
  return { label: "No data yet", className: "text-muted-foreground ring-border bg-muted/30" };
}

export default function LocalizedPagesPanel({ rows, engagement }: Props) {
  const stats = useMemo<PageStat[]>(() => {
    const byPath = new Map<string, { clicks: number; impressions: number; positions: number[]; queries: Set<string> }>();
    for (const row of rows) {
      const path = toPath(row.page);
      const agg =
        byPath.get(path) ?? { clicks: 0, impressions: 0, positions: [] as number[], queries: new Set<string>() };
      agg.clicks += row.clicks;
      agg.impressions += row.impressions;
      if (row.position > 0) agg.positions.push(row.position);
      if (row.query) agg.queries.add(row.query);
      byPath.set(path, agg);
    }
    return LOCALIZED_PAGES.map((p) => {
      const agg = byPath.get(p.path);
      return {
        ...p,
        clicks: agg?.clicks ?? 0,
        impressions: agg?.impressions ?? 0,
        ctr: agg && agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        avgPosition:
          agg && agg.positions.length > 0
            ? agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length
            : null,
        queries: agg?.queries.size ?? 0,
      };
    }).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  }, [rows]);

  const totals = useMemo(
    () =>
      stats.reduce(
        (acc, s) => ({
          clicks: acc.clicks + s.clicks,
          impressions: acc.impressions + s.impressions,
          indexed: acc.indexed + (s.impressions > 0 ? 1 : 0),
        }),
        { clicks: 0, impressions: 0, indexed: 0 },
      ),
    [stats],
  );

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="ds-text-16 font-semibold">Localized pages</h2>
        <span className="ds-text-11 text-muted-foreground tabular-nums">
          {totals.indexed}/{stats.length} with impressions · {totals.clicks.toLocaleString()} clicks ·{" "}
          {totals.impressions.toLocaleString()} impr
        </span>
      </div>

      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full ds-text-13">
            <thead className="bg-muted/30 text-muted-foreground ds-text-11">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Page</th>
                <th className="text-left px-3 py-2 font-medium">Coverage</th>
                <th className="text-right px-3 py-2 font-medium">Clicks</th>
                <th className="text-right px-3 py-2 font-medium">Impr</th>
                <th className="text-right px-3 py-2 font-medium">CTR</th>
                <th className="text-right px-3 py-2 font-medium">Pos</th>
                <th className="text-right px-3 py-2 font-medium">Queries</th>
                <th className="text-right px-3 py-2 font-medium">Avg time</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const status = statusOf(s);
                const eng = engagement?.[s.path];
                return (
                  <tr key={s.path} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{s.flag}</span>
                        <span className="ds-text-12">{s.label}</span>
                        <code className="ds-text-11 text-muted-foreground">{s.path}</code>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`ds-text-11 px-2 py-0.5 rounded-full ring-1 ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {s.impressions.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercent(s.ctr * 100)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPos(s.avgPosition)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {s.queries.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtSeconds(eng?.avgSeconds ?? null)}
                      {eng?.samples ? (
                        <span className="ds-text-11 text-muted-foreground"> ({eng.samples})</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={gscInspectUrl(s.path)}
                        target="_blank"
                        rel="noreferrer"
                        title="Inspect URL in Search Console"
                        aria-label={`Inspect ${s.path} in Search Console`}
                        className="inline-flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:ring-2 hover:ring-border transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="ds-text-11 text-muted-foreground px-3 py-2 border-t border-border/40 bg-muted/20">
          Coverage is inferred from Search Console impressions in the selected range. Average time comes
          from the on-page <code className="bg-muted/40 px-1 rounded">time_on_page</code> analytics event and
          shows “—” until that data is wired into the SEO backend.
        </div>
      </div>
    </section>
  );
}
