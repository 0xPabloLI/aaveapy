import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { trackFaqToggle, trackInternalLink } from '@/lib/pageAnalytics';
import { useTimeOnPage } from '@/hooks/useTimeOnPage';
import { useStripStaticHeadTags } from '@/components/seo/useStripStaticHeadTags';

const SITE_ORIGIN = 'https://aaveapy.com';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image-1200x630.jpg`;

export interface RatesPageSection {
  id: string;
  h2: string;
  paragraphs: string[];
}

export interface RatesPageContent {
  /** Path without origin, e.g. "/fr/taux-aave-apy" */
  path: string;
  /** html lang attribute, e.g. "fr" */
  lang: string;
  /** og:locale, e.g. "fr_FR" */
  ogLocale: string;
  title: string;
  description: string;
  /** Absolute https URL for og:image / twitter:image. Defaults to the shared 1200x630 share card. */
  ogImage?: string;
  /** Alt text for the share image, localized. */
  ogImageAlt?: string;
  h1: string;
  intro: string;
  cta: { label: string; to: string };
  breadcrumb: {
    ariaLabel: string;
    home: { label: string; to: string };
    current: string;
  };
  sections: RatesPageSection[];
  drivers: { h2: string; id: string; items: { title: string; body: string }[] };
  howTo: { h2: string; id: string; steps: string[] };
  faq: { h2: string; items: { q: string; a: string }[] };
  related: { ariaLabel: string; links: { to: string; label: string }[] };
}

type TrackedLinkProps = ComponentProps<typeof Link> & { trackLabel: string; page: string };

const TrackedLink = ({ trackLabel, page, onClick, ...props }: TrackedLinkProps) => (
  <Link
    {...props}
    onClick={(e) => {
      trackInternalLink(page, trackLabel, String(props.to));
      onClick?.(e);
    }}
  />
);

export function LocalizedRatesPage({ content }: { content: RatesPageContent }) {
  const analyticsPage = content.path.replace(/^\//, '');
  useTimeOnPage(analyticsPage);
  useStripStaticHeadTags();

  const canonical = `${SITE_ORIGIN}${content.path}`;
  const ogImage = content.ogImage ?? DEFAULT_OG_IMAGE;
  const ogImageAlt = content.ogImageAlt ?? content.title;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: content.title,
    description: content.description,
    url: canonical,
    inLanguage: content.lang,
    isPartOf: { '@type': 'WebSite', name: 'AaveAPY', url: `${SITE_ORIGIN}/` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: content.breadcrumb.home.label,
          item: `${SITE_ORIGIN}${content.breadcrumb.home.to}`,
        },
        { '@type': 'ListItem', position: 2, name: content.breadcrumb.current, item: canonical },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <html lang={content.lang} />
        <title>{content.title}</title>
        <meta name="description" content={content.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={content.title} />
        <meta property="og:description" content={content.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonical} />
        <meta property="og:locale" content={content.ogLocale} />
        <meta property="og:site_name" content="AaveAPY" />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={ogImageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.title} />
        <meta name="twitter:description" content={content.description} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content={ogImageAlt} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
          <nav className="mb-6 text-sm text-muted-foreground" aria-label={content.breadcrumb.ariaLabel}>
            <TrackedLink
              page={analyticsPage}
              trackLabel="breadcrumb_home"
              to={content.breadcrumb.home.to}
              className="hover:text-foreground transition-colors"
            >
              {content.breadcrumb.home.label}
            </TrackedLink>
            <span className="mx-2">/</span>
            <span className="text-foreground">{content.breadcrumb.current}</span>
          </nav>

          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{content.h1}</h1>
            <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
              {content.intro}
            </p>
          </header>

          <TrackedLink
            page={analyticsPage}
            trackLabel="cta_live_dashboard"
            to={content.cta.to}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
          >
            {content.cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </TrackedLink>

          {content.sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id} className="mt-10">
              <h2 id={s.id} className="text-xl font-semibold mb-3">
                {s.h2}
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                {s.paragraphs.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
            </section>
          ))}

          <section aria-labelledby={content.drivers.id} className="mt-10">
            <h2 id={content.drivers.id} className="text-xl font-semibold mb-4">
              {content.drivers.h2}
            </h2>
            <ul className="space-y-4">
              {content.drivers.items.map((d) => (
                <li key={d.title} className="rounded-xl border border-border/60 bg-card p-4">
                  <h3 className="text-base font-semibold">{d.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{d.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={content.howTo.id} className="mt-10">
            <h2 id={content.howTo.id} className="text-xl font-semibold mb-3">
              {content.howTo.h2}
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground leading-relaxed">
              {content.howTo.steps.map((step) => (
                <li key={step.slice(0, 32)}>{step}</li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="text-2xl font-bold tracking-tight mb-4">
              {content.faq.h2}
            </h2>
            <div className="space-y-3">
              {content.faq.items.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border/60 bg-card p-5"
                  onToggle={(e) => trackFaqToggle(analyticsPage, f.q, e.currentTarget.open)}
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-base font-semibold text-foreground">
                    <span>{f.q}</span>
                    <span className="text-muted-foreground transition group-open:rotate-45 text-xl leading-none select-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <nav aria-label={content.related.ariaLabel} className="mt-12 text-sm text-muted-foreground">
            {content.related.links.map((l, i) => (
              <span key={l.to}>
                {i > 0 && ' · '}
                <TrackedLink
                  page={analyticsPage}
                  trackLabel={`related_${l.to.replace(/[^a-z0-9]+/gi, '_')}`}
                  to={l.to}
                  className="text-secondary hover:underline"
                >
                  {l.label}
                </TrackedLink>
              </span>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}
