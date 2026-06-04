// Aggregates Semrush backlinks_pages for a curated set of Aave-focused news
// domains and returns pages whose URL contains "aave", ranked by backlinks.
// Gated by the same SEO_DASHBOARD_PASSWORD secret used by AdminSeo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dashboard-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/semrush";

// Curated Aave-focused crypto news domains. Edit to add/remove sources.
const DEFAULT_DOMAINS = [
  "theblock.co",
  "coindesk.com",
  "decrypt.co",
  "cointelegraph.com",
  "bankless.com",
  "dlnews.com",
  "theblockcrypto.com",
  "blockworks.co",
  "cryptobriefing.com",
  "cryptoslate.com",
  "thedefiant.io",
  "defillama.com",
  "messari.io",
  "ambcrypto.com",
  "u.today",
  "beincrypto.com",
];

interface AggregatedPage {
  domain: string;
  url: string;
  backlinks: number;
  refDomains: number;
  lastSeen: string | null;
}

interface DomainResult {
  domain: string;
  pageCount: number;
  totalBacklinks: number;
  error?: string;
}

async function fetchDomain(
  domain: string,
  perDomainLimit: number,
  lovableKey: string,
  semrushKey: string,
): Promise<{ pages: AggregatedPage[]; meta: DomainResult }> {
  const params = new URLSearchParams({
    target: domain,
    target_type: "root_domain",
    export_columns: "url,backlinks_num,domains_num,last_seen",
    display_limit: String(perDomainLimit),
    display_sort: "backlinks_num_desc",
  });
  const url = `${GATEWAY}/backlinks/backlinks_pages?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": semrushKey,
      "Allow-Limit-Offset": "true",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      pages: [],
      meta: { domain, pageCount: 0, totalBacklinks: 0, error: `HTTP ${res.status}: ${text.slice(0, 200)}` },
    };
  }
  let json: unknown;
  try { json = JSON.parse(text); } catch {
    return { pages: [], meta: { domain, pageCount: 0, totalBacklinks: 0, error: "Invalid JSON" } };
  }
  const data = (json as { data?: { columnNames?: string[]; rows?: unknown[][] } }).data;
  const cols = data?.columnNames ?? [];
  const rows = data?.rows ?? [];
  const idx = {
    url: cols.indexOf("url"),
    backlinks: cols.indexOf("backlinks_num"),
    refDomains: cols.indexOf("domains_num"),
    lastSeen: cols.indexOf("last_seen"),
  };
  const pages: AggregatedPage[] = [];
  let total = 0;
  for (const row of rows) {
    const u = String(row[idx.url] ?? "");
    if (!u || !/aave/i.test(u)) continue;
    const backlinks = Number(row[idx.backlinks] ?? 0) || 0;
    const refDomains = Number(row[idx.refDomains] ?? 0) || 0;
    const lastSeen = idx.lastSeen >= 0 ? String(row[idx.lastSeen] ?? "") || null : null;
    pages.push({ domain, url: u, backlinks, refDomains, lastSeen });
    total += backlinks;
  }
  return { pages, meta: { domain, pageCount: pages.length, totalBacklinks: total } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dashboardPassword = Deno.env.get("SEO_DASHBOARD_PASSWORD");
  if (!dashboardPassword) {
    return new Response(JSON.stringify({ error: "SEO_DASHBOARD_PASSWORD not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-dashboard-password") !== dashboardPassword) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const semrushKey = Deno.env.get("SEMRUSH_API_KEY");
  if (!lovableKey || !semrushKey) {
    return new Response(JSON.stringify({ error: "Semrush connector not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const customDomains = url.searchParams.get("domains");
  const domains = customDomains
    ? customDomains.split(",").map(s => s.trim()).filter(Boolean)
    : DEFAULT_DOMAINS;
  const perDomainLimit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
  const topN = Math.min(Number(url.searchParams.get("top") || 50), 200);

  const results = await Promise.all(
    domains.map(d => fetchDomain(d, perDomainLimit, lovableKey, semrushKey)),
  );
  const allPages = results.flatMap(r => r.pages).sort((a, b) => b.backlinks - a.backlinks);
  const meta = results.map(r => r.meta);

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      domains: meta,
      pages: allPages.slice(0, topN),
      totalPagesFound: allPages.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
