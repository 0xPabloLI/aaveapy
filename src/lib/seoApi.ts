/**
 * Client for the SEO admin API.
 *
 * Calls go through the Lovable Cloud `seo-proxy` edge function, which injects the
 * `X-Admin-Token` header from the `SEO_ADMIN_TOKEN` server-side secret. The token
 * is never exposed to the browser bundle (we deliberately do not use a `VITE_`
 * prefixed env var, per docs/seo/m3-railway-backend-spec.md §3.1).
 */

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface GscRow {
  date: string;
  country: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscResponse {
  rows: GscRow[];
  total: number;
}

export interface SemrushRow {
  id: number;
  snapshot_date: string;
  country: string;
  keyword: string;
  volume: number | null;
  position: number | null;
  cpc_usd: number | null;
  difficulty: number | null;
  notes: string | null;
}

export interface SemrushResponse {
  rows: SemrushRow[];
}

export interface SemrushBatchInput {
  snapshot_date: string;
  country: string;
  keyword: string;
  volume?: number | null;
  position?: number | null;
  cpc_usd?: number | null;
  difficulty?: number | null;
  notes?: string | null;
}

const DASHBOARD_PASSWORD_KEY = "seo-dashboard-password";

export function setDashboardPassword(pw: string) {
  sessionStorage.setItem(DASHBOARD_PASSWORD_KEY, pw);
}
export function getDashboardPassword(): string {
  return sessionStorage.getItem(DASHBOARD_PASSWORD_KEY) || "";
}
export function clearDashboardPassword() {
  sessionStorage.removeItem(DASHBOARD_PASSWORD_KEY);
}

async function seoFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${FN_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Supabase functions gateway requires the anon key for routing even when
      // the function itself is configured with verify_jwt = false.
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "X-Dashboard-Password": getDashboardPassword(),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail: unknown = text;
    try {
      detail = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const err = new Error(
      typeof detail === "object" && detail !== null && "error" in detail
        ? String((detail as { error: unknown }).error)
        : `SEO API request failed (${res.status})`,
    );
    (err as Error & { status?: number; detail?: unknown }).status = res.status;
    (err as Error & { status?: number; detail?: unknown }).detail = detail;
    throw err;
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// Backend may return either a bare array or { rows, total }. Normalize.
function unwrapRows<T>(raw: unknown): { rows: T[]; total: number } {
  if (Array.isArray(raw)) return { rows: raw as T[], total: raw.length };
  if (raw && typeof raw === "object" && "rows" in raw) {
    const r = (raw as { rows: T[]; total?: number }).rows ?? [];
    return { rows: r, total: (raw as { total?: number }).total ?? r.length };
  }
  return { rows: [], total: 0 };
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface FetchGscParams {
  from: string;
  to: string;
  country?: string[];
  page?: string;
  groupBy?: Array<"date" | "country" | "page" | "query">;
}

export async function fetchGscRows(params: FetchGscParams): Promise<GscResponse> {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.country?.length) sp.set("country", params.country.join(","));
  if (params.page) sp.set("page", params.page);
  if (params.groupBy?.length) sp.set("groupBy", params.groupBy.join(","));
  const raw = await seoFetch<unknown>(`/gsc?${sp.toString()}`);
  return unwrapRows<GscRow>(raw);
}

export interface FetchSemrushParams {
  country?: string[];
  from?: string;
  to?: string;
  keyword?: string;
}

export async function fetchSemrushRows(
  params: FetchSemrushParams = {},
): Promise<SemrushResponse> {
  const sp = new URLSearchParams();
  if (params.country?.length) sp.set("country", params.country.join(","));
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.keyword) sp.set("keyword", params.keyword);
  const qs = sp.toString();
  const raw = await seoFetch<unknown>(`/semrush${qs ? `?${qs}` : ""}`);
  const { rows } = unwrapRows<Record<string, unknown>>(raw);
  // Postgres numeric/bigint columns serialize as strings — coerce to numbers.
  const normalized: SemrushRow[] = rows.map((r) => ({
    id: Number(r.id),
    snapshot_date: String(r.snapshot_date),
    country: String(r.country),
    keyword: String(r.keyword),
    volume: toNum(r.volume),
    position: toNum(r.position),
    cpc_usd: toNum(r.cpc_usd),
    difficulty: toNum(r.difficulty),
    notes: r.notes == null ? null : String(r.notes),
  }));
  return { rows: normalized };
}

export function postSemrushBatch(
  snapshots: SemrushBatchInput[],
): Promise<{ upserted: number; total: number; errors?: unknown[] }> {
  return seoFetch("/semrush/batch", {
    method: "POST",
    body: JSON.stringify({ snapshots }),
  });
}

export function deleteSemrush(id: number): Promise<{ deleted: true; id: number }> {
  return seoFetch(`/semrush/${id}`, { method: "DELETE" });
}

