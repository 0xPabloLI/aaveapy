import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { getSeoChainBySlug, SEO_CHAINS } from '@/lib/seoChains';
import { getChainIconSrc } from '@/lib/chainIcons';
import NotFound from '@/pages/NotFound';

const SITE_ORIGIN = 'https://aaveapy.com';

const ChainPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const chain = useMemo(() => getSeoChainBySlug(slug), [slug]);

  if (!chain) {
    return <NotFound />;
  }

  const canonical = `${SITE_ORIGIN}/chain/${chain.slug}`;
  const iconSrc = getChainIconSrc(chain.chainId);
  const dashboardHref = `/?chain=${encodeURIComponent(chain.chainNameMatchers[0])}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: chain.title,
    description: chain.description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AAVE APY',
      url: `${SITE_ORIGIN}/`,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: chain.displayName, item: canonical },
      ],
    },
  };

  return (
    <>
      <Helmet>
        <title>{chain.title}</title>
        <meta name="description" content={chain.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={chain.title} />
        <meta property="og:description" content={chain.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={chain.title} />
        <meta name="twitter:description" content={chain.description} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{chain.displayName}</span>
          </nav>

          <header className="flex items-center gap-4 mb-6">
            {iconSrc ? (
              <img
                src={iconSrc}
                alt={`${chain.displayName} chain icon`}
                width={48}
                height={48}
                className="rounded-full ring-1 ring-border"
                loading="eager"
              />
            ) : null}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Aave APY on {chain.displayName}
            </h1>
          </header>

          <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
            {chain.intro}
          </p>

          <section aria-labelledby="highlights" className="mb-10">
            <h2 id="highlights" className="text-xl font-semibold mb-3">
              What you can track on {chain.displayName}
            </h2>
            <ul className="space-y-2">
              {chain.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-foreground">
                  <span aria-hidden className="text-primary">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>

          <Link
            to={dashboardHref}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
          >
            View {chain.displayName} markets
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <section aria-labelledby="other-chains" className="mt-14 border-t border-border/60 pt-8">
            <h2 id="other-chains" className="text-lg font-semibold mb-3">
              Other supported chains
            </h2>
            <ul className="flex flex-wrap gap-2">
              {SEO_CHAINS.filter((c) => c.slug !== chain.slug).map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/chain/${c.slug}`}
                    className="inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1 text-sm hover:ring-2 hover:ring-border transition-all"
                  >
                    {c.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
};

export default ChainPage;
