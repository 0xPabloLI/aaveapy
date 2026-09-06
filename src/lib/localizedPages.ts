/**
 * Registry of the localized SEO landing pages tracked in the admin dashboard.
 * Path values must match the routes registered in src/App.tsx and the sitemap.
 */

export interface LocalizedPageEntry {
  /** Path without origin, e.g. "/fr/taux-aave-apy" */
  path: string;
  /** html lang / locale label */
  locale: string;
  flag: string;
  label: string;
}

export const SITE_ORIGIN = "https://aaveapy.com";

export const LOCALIZED_PAGES: LocalizedPageEntry[] = [
  { path: "/pt-br/taxas-aave-apy", locale: "pt-BR", flag: "🇧🇷", label: "Português" },
  { path: "/fr/taux-aave-apy", locale: "fr", flag: "🇫🇷", label: "Français" },
  { path: "/de/aave-zinsen-apy", locale: "de", flag: "🇩🇪", label: "Deutsch" },
  { path: "/es/tasas-aave-apy", locale: "es", flag: "🇪🇸", label: "Español" },
  { path: "/it/tassi-aave-apy", locale: "it", flag: "🇮🇹", label: "Italiano" },
  { path: "/id/apy-aave", locale: "id", flag: "🇮🇩", label: "Bahasa" },
  { path: "/ja/aave-kinri-apy", locale: "ja", flag: "🇯🇵", label: "日本語" },
  { path: "/ru/stavki-aave-apy", locale: "ru", flag: "🇷🇺", label: "Русский" },
  { path: "/zh/aave-lilv-apy", locale: "zh", flag: "🇹🇼", label: "中文" },
];

/** Normalize a GSC `page` value (absolute URL) to a path for matching. */
export function toPath(pageUrl: string): string {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, "");
  return path.replace(/\/+$/, "") || "/";
}

/** Search Console URL Inspection deep link for a given page. */
export function gscInspectUrl(path: string, property = `sc-domain:${new URL(SITE_ORIGIN).hostname}`): string {
  const resource = encodeURIComponent(property);
  const inspect = encodeURIComponent(`${SITE_ORIGIN}${path}`);
  return `https://search.google.com/search-console/inspect?resource_id=${resource}&id=${inspect}`;
}
