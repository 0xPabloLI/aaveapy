import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import SeoDashboardGate from "@/components/admin/SeoDashboardGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getDashboardPassword } from "@/lib/seoApi";

interface Page {
  domain: string;
  url: string;
  backlinks: number;
  refDomains: number;
  lastSeen: string | null;
}
interface DomainMeta {
  domain: string;
  pageCount: number;
  totalBacklinks: number;
  error?: string;
}
interface ApiResponse {
  generatedAt: string;
  domains: DomainMeta[];
  pages: Page[];
  totalPagesFound: number;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aave-news-backlinks`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function fetchBacklinks(domains: string, top: number): Promise<ApiResponse> {
  const params = new URLSearchParams({ top: String(top) });
  if (domains.trim()) params.set("domains", domains.trim());
  const res = await fetch(`${FN_URL}?${params}`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "X-Dashboard-Password": getDashboardPassword(),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Dashboard() {
  const [domainsInput, setDomainsInput] = useState("");
  const [top, setTop] = useState(50);
  const [submitted, setSubmitted] = useState({ domains: "", top: 50 });

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["aave-news-backlinks", submitted],
    queryFn: () => fetchBacklinks(submitted.domains, submitted.top),
    staleTime: 10 * 60 * 1000,
  });

  const totalsByDomain = useMemo(() => data?.domains ?? [], [data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Aave News Backlinks · Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Aave news backlinks
          </h1>
          <p className="text-sm text-muted-foreground">
            Ranks Aave-related URLs across curated crypto news domains by total
            backlinks. Powered by the Semrush connector (backlinks_pages,
            filtered to URLs containing &ldquo;aave&rdquo;).
          </p>
        </header>

        <section className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Domains (comma-separated, optional — defaults to curated list)
              </label>
              <Input
                placeholder="theblock.co, coindesk.com, decrypt.co, …"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Top N</label>
              <Input
                type="number"
                min={10}
                max={200}
                value={top}
                onChange={(e) => setTop(Number(e.target.value) || 50)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSubmitted({ domains: domainsInput, top });
                  refetch();
                }}
                disabled={isFetching}
                className="w-full md:w-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                Run
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}
          {data && (
            <p className="text-xs text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()} ·{" "}
              {data.totalPagesFound} matching pages across {totalsByDomain.length} domains
            </p>
          )}
        </section>

        {totalsByDomain.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-medium border-b border-border/60">
              Per-domain summary
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Aave pages</TableHead>
                  <TableHead className="text-right">Total backlinks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totalsByDomain.map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(d.pageCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(d.totalBacklinks)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.error ? <span className="text-destructive">{d.error}</span> : "ok"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {data && data.pages.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-medium border-b border-border/60">
              Top Aave-linked pages
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Backlinks</TableHead>
                  <TableHead className="text-right">Ref. domains</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages.map((p, i) => (
                  <TableRow key={`${p.domain}-${p.url}-${i}`}>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-xl">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline truncate"
                        title={p.url}
                      >
                        <span className="truncate">{p.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.domain}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(p.backlinks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(p.refDomains)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.lastSeen ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {data && data.pages.length === 0 && !isFetching && (
          <p className="text-sm text-muted-foreground">
            No matching pages found. Try a different domain set or raise the per-domain limit.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminAaveNewsBacklinksPage() {
  return <SeoDashboardGate>{() => <Dashboard />}</SeoDashboardGate>;
}
