import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';

const SITE_ORIGIN = 'https://aaveapy.com';
const CANONICAL = `${SITE_ORIGIN}/usa-stablecoin-apy`;
const TITLE = 'USA Stablecoin APY — Best USDC, USDT, PYUSD & USDS Rates';
const DESCRIPTION =
  'Compare live APYs for US-friendly stablecoins (USDC, USDT, PYUSD, USDS) across every Aave market. All incentives included in the effective yield.';

const STABLES = [
  {
    symbol: 'USDC',
    slug: 'usdc',
    summary:
      'Circle-issued USD stablecoin, the deepest stablecoin on Aave. Native USDC on Ethereum, Base, Arbitrum, Polygon, Optimism and more.',
  },
  {
    symbol: 'USDT',
    slug: 'usdt',
    summary:
      'Tether USD, the highest-volume stablecoin globally. Active Aave markets on Ethereum, Arbitrum, Polygon, Avalanche, BNB Chain and Optimism.',
  },
  {
    symbol: 'DAI',
    slug: 'dai',
    summary:
      'MakerDAO-issued decentralized stablecoin, widely used across Aave deployments on Ethereum, Arbitrum, Optimism, Polygon and Gnosis.',
  },
  {
    symbol: 'GHO',
    slug: 'gho',
    summary:
      "Aave's own overcollateralized stablecoin, minted directly against Aave V3 deposits. Discount available to stkAAVE stakers.",
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: TITLE,
  description: DESCRIPTION,
  url: CANONICAL,
  isPartOf: { '@type': 'WebSite', name: 'AaveAPY', url: `${SITE_ORIGIN}/` },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'USA Stablecoin APY', item: CANONICAL },
    ],
  },
};

const UsaStablecoinApy = () => (
  <>
    <Helmet>
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <link rel="canonical" href={CANONICAL} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={CANONICAL} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={TITLE} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>

    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
        <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">USA Stablecoin APY</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            USA Stablecoin APY on Aave
          </h1>
          <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
            Compare live supply and borrow APYs for US-friendly stablecoins — USDC, USDT, DAI, and GHO — across every Aave market on every chain. All Merit, Merkl, and Brevis incentives are baked into the effective yield, so the numbers you see are what you'd actually earn.
          </p>
        </header>

        <Link
          to="/?category=stablecoin"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
        >
          Compare stablecoin APYs now
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>

        <section aria-labelledby="stables" className="mt-10">
          <h2 id="stables" className="text-xl font-semibold mb-4">
            Stablecoins covered
          </h2>
          <ul className="space-y-4">
            {STABLES.map((s) => (
              <li key={s.slug} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{s.symbol}</h3>
                  <Link
                    to={`/asset/${s.slug}`}
                    className="text-sm text-primary underline-offset-4 hover:underline whitespace-nowrap"
                  >
                    Live {s.symbol} APYs →
                  </Link>
                </div>
                <p className="mt-2 text-muted-foreground leading-relaxed">{s.summary}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how" className="mt-10">
          <h2 id="how" className="text-xl font-semibold mb-3">
            How stablecoin APY works on Aave
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Aave sets supply and borrow rates algorithmically based on pool utilization — the ratio of borrowed to supplied assets. When utilization is low, rates stay moderate; when liquidity runs tight, rates spike to attract deposits. On top of the base rate, active incentive programs (Merit from Aave, Merkl from third parties, Brevis on select chains) add token rewards that lift the effective APY beyond what the curve alone would pay.
          </p>
        </section>

        <section aria-labelledby="why" className="mt-10">
          <h2 id="why" className="text-xl font-semibold mb-3">
            Why compare across chains
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            The same stablecoin can pay very different effective yields depending on the chain. USDC on Base might earn more than USDC on Ethereum on any given day, simply because incentive campaigns and utilization differ. Use the{' '}
            <Link to="/?category=stablecoin" className="text-primary underline-offset-4 hover:underline">stablecoin dashboard</Link>{' '}
            to see all markets at once, or drill into per-chain breakdowns like{' '}
            <Link to="/chain/base" className="text-primary underline-offset-4 hover:underline">Base</Link>,{' '}
            <Link to="/chain/arbitrum" className="text-primary underline-offset-4 hover:underline">Arbitrum</Link>, and{' '}
            <Link to="/chain/polygon" className="text-primary underline-offset-4 hover:underline">Polygon</Link>.
          </p>
        </section>
      </div>
    </main>
  </>
);

export default UsaStablecoinApy;
