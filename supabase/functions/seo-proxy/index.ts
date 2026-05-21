// BFF: forwards /seo/* requests to the Railway backend with the admin token.
// Token lives in Lovable Cloud secret SEO_ADMIN_TOKEN and is never exposed to the browser.
// Optional override: SEO_API_BASE (defaults to staging-api.aaveapy.com/api).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dashboard-password",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const DEFAULT_BASE = "https://staging-api.aaveapy.com/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminToken = Deno.env.get("SEO_ADMIN_TOKEN");
  if (!adminToken) {
    return new Response(
      JSON.stringify({ error: "SEO_ADMIN_TOKEN not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Dashboard password gate. Caller (the AdminSeo UI) must send
  // X-Dashboard-Password matching the SEO_DASHBOARD_PASSWORD secret.
  const dashboardPassword = Deno.env.get("SEO_DASHBOARD_PASSWORD");
  if (!dashboardPassword) {
    return new Response(
      JSON.stringify({ error: "SEO_DASHBOARD_PASSWORD not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const provided = req.headers.get("x-dashboard-password");
  if (provided !== dashboardPassword) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiBase = (Deno.env.get("SEO_API_BASE") || DEFAULT_BASE).replace(/\/$/, "");

  const url = new URL(req.url);
  // Strip the function prefix, e.g. /seo-proxy/gsc?from=... → /seo/gsc?from=...
  const fnPrefix = "/seo-proxy";
  const idx = url.pathname.indexOf(fnPrefix);
  const tail = idx >= 0 ? url.pathname.slice(idx + fnPrefix.length) : url.pathname;
  const upstreamPath = `/seo${tail.startsWith("/") ? tail : `/${tail}`}`;
  const upstreamUrl = `${apiBase}${upstreamPath}${url.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "X-Admin-Token": adminToken,
      "Content-Type": req.headers.get("content-type") || "application/json",
    },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "upstream_fetch_failed", details: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
