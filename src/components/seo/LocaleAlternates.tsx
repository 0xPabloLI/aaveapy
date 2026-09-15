import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { LOCALIZED_PAGES, SITE_ORIGIN } from '@/lib/localizedPages';
import { trackInternalLink } from '@/lib/pageAnalytics';

/**
 * hreflang alternates shared by every localized landing page.
 * Emitted in its own Helmet instance so pages keep their own head blocks.
 */
export function LocaleAlternates() {
  return (
    <Helmet>
      {LOCALIZED_PAGES.map((p) => (
        <link key={p.path} rel="alternate" hrefLang={p.locale} href={`${SITE_ORIGIN}${p.path}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE_ORIGIN}/`} />
    </Helmet>
  );
}

/**
 * Visible cross-locale link matrix. Every localized page links to every other one,
 * which spreads crawl equity across the language cluster.
 */
export function LanguageSwitcher({
  currentPath,
  ariaLabel = 'Other languages',
  analyticsPage,
}: {
  currentPath: string;
  ariaLabel?: string;
  analyticsPage: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="mt-8 border-t border-border/60 pt-6 text-sm">
      <p className="mb-2 text-muted-foreground">{ariaLabel}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {LOCALIZED_PAGES.filter((p) => p.path !== currentPath).map((p) => (
          <li key={p.path}>
            <Link
              to={p.path}
              hrefLang={p.locale}
              lang={p.locale}
              className="text-secondary hover:underline"
              onClick={() => trackInternalLink(analyticsPage, `locale_${p.locale}`, p.path)}
            >
              <span aria-hidden="true" className="mr-1">
                {p.flag}
              </span>
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
