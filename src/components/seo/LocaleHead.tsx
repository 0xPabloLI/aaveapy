import { Helmet } from "react-helmet-async";
import { LOCALE_PATH_MAP, SITE_ORIGIN, type SupportedLocale } from "@/i18n";

interface LocaleHeadProps {
  locale: SupportedLocale;
  path: string; // e.g. "/pt-br" or ""
  title: string;
  description: string;
  ogLocale: string;
  jsonLd?: Record<string, unknown>;
}

const HREFLANG_ENTRIES: Array<{ hreflang: string; path: string }> = [
  { hreflang: "en", path: "/" },
  { hreflang: "pt-BR", path: `/${LOCALE_PATH_MAP["pt-BR"]}` },
  { hreflang: "fr", path: `/${LOCALE_PATH_MAP.fr}` },
  { hreflang: "tr", path: `/${LOCALE_PATH_MAP.tr}` },
  { hreflang: "x-default", path: "/" },
];

export function LocaleHead({ locale, path, title, description, ogLocale, jsonLd }: LocaleHeadProps) {
  const canonical = `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
  const htmlLang = locale === "en" ? "en" : locale;
  return (
    <Helmet>
      <html lang={htmlLang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={ogLocale} />
      {HREFLANG_ENTRIES.map((e) => (
        <link
          key={e.hreflang}
          rel="alternate"
          hrefLang={e.hreflang}
          href={`${SITE_ORIGIN}${e.path}`}
        />
      ))}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
