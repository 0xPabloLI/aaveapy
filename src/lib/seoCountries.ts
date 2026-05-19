/**
 * Country code mapping between data sources.
 * - GSC uses ISO-3166-1 alpha-3 (e.g. 'bra', 'fra', 'tur', 'usa', 'deu', 'ind')
 * - Semrush uses 2-letter database codes (e.g. 'br', 'fr', 'tr', 'us', 'de', 'in')
 */

export interface SeoCountry {
  /** ISO alpha-3 (GSC) */
  alpha3: string;
  /** Semrush 2-letter database code */
  semrush: string;
  /** Display label */
  label: string;
  /** Flag emoji */
  flag: string;
}

export const SEO_COUNTRIES: readonly SeoCountry[] = [
  { alpha3: "bra", semrush: "br", label: "Brazil", flag: "🇧🇷" },
  { alpha3: "fra", semrush: "fr", label: "France", flag: "🇫🇷" },
  { alpha3: "tur", semrush: "tr", label: "Türkiye", flag: "🇹🇷" },
  { alpha3: "usa", semrush: "us", label: "United States", flag: "🇺🇸" },
  { alpha3: "deu", semrush: "de", label: "Germany", flag: "🇩🇪" },
  { alpha3: "ind", semrush: "in", label: "India", flag: "🇮🇳" },
] as const;

const ALPHA3_TO_COUNTRY = new Map(SEO_COUNTRIES.map((c) => [c.alpha3, c]));
const SEMRUSH_TO_COUNTRY = new Map(SEO_COUNTRIES.map((c) => [c.semrush, c]));

export function countryFromAlpha3(code: string): SeoCountry | undefined {
  return ALPHA3_TO_COUNTRY.get(code.toLowerCase());
}

export function countryFromSemrush(code: string): SeoCountry | undefined {
  return SEMRUSH_TO_COUNTRY.get(code.toLowerCase());
}

export function semrushToAlpha3(code: string): string | undefined {
  return SEMRUSH_TO_COUNTRY.get(code.toLowerCase())?.alpha3;
}

export function alpha3ToSemrush(code: string): string | undefined {
  return ALPHA3_TO_COUNTRY.get(code.toLowerCase())?.semrush;
}
