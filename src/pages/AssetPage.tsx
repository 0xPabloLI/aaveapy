import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { getSeoAssetBySlug, SEO_ASSETS } from '@/lib/seoAssets';
import { SEO_CHAINS, getSeoChainBySlug } from '@/lib/seoChains';
import NotFound from '@/pages/NotFound';

const SITE_ORIGIN = 'https://aaveapy.com';

const AssetPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const asset = useMemo(() => getSeoAssetBySlug(slug), [slug]);

  if (!asset) return <NotFound />;

  const canonical = `${SITE_ORIGIN}/asset/${asset.slug}`;
  const dashboardHref = `/?search=${encodeURIComponent(asset.symbolMatcher)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: asset.title,
    description: asset.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'AaveAPY', url: `${SITE_ORIGIN}/` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: `Aave ${asset.symbol} APY`, item: canonical },
      ],
    },
  };

  const topChains = asset.topChains
    .map((s) => getSeoChainBySlug(s))
    .filter((c): c is NonNullable<ReturnType<typeof getSeoChainBySlug>> => Boolean(c));

  return (
    <>
      <Helmet>
        <title>{asset.title}</title>
        <meta name="description" content={asset.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={asset.title} />
        <meta property="og:description" content={asset.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={asset.title} />
        <meta name="twitter:description" content={asset.description} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Aave {asset.symbol} APY</span>
          </nav>

          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Aave {asset.displayName} APY
            </h1>
            <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
              {asset.intro}
            </p>
          </header>

          <Link
            to={dashboardHref}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
          >
            Compare {asset.symbol} markets now
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <section aria-labelledby="highlights" className="mt-10">
            <h2 id="highlights" className="text-xl font-semibold mb-3">
              What you can track for {asset.symbol}
            </h2>
            <ul className="space-y-2">
              {asset.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden className="text-primary">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>

          {topChains.length > 0 && (
            <section aria-labelledby="top-chains" className="mt-10">
              <h2 id="top-chains" className="text-xl font-semibold mb-3">
                {asset.symbol} on top chains
              </h2>
              <ul className="flex flex-wrap gap-2">
                {topChains.map((c) => (
                  <li key={c.slug}>
                    <Link
                      to={`/chain/${c.slug}`}
                      className="inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1 text-sm hover:ring-2 hover:ring-border transition-all"
                    >
                      {asset.symbol} on {c.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="other-assets" className="mt-14 border-t border-border/60 pt-8">
            <h2 id="other-assets" className="text-lg font-semibold mb-3">
              Other Aave assets
            </h2>
            <ul className="flex flex-wrap gap-2">
              {SEO_ASSETS.filter((a) => a.slug !== asset.slug).map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/asset/${a.slug}`}
                    className="inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1 text-sm hover:ring-2 hover:ring-border transition-all"
                  >
                    Aave {a.symbol} APY
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="all-chains" className="mt-10">
            <h2 id="all-chains" className="text-lg font-semibold mb-3">
              Browse by chain
            </h2>
            <ul className="flex flex-wrap gap-2">
              {SEO_CHAINS.map((c) => (
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

export default AssetPage;
