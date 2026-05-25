import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { SEO_CHAINS } from '@/lib/seoChains';

const SITE_ORIGIN = 'https://aaveapy.com';
const CANONICAL = `${SITE_ORIGIN}/defi-yield-tracker`;

const TITLE = 'DeFi Yield Tracker for Aave — Live APY Across Every Chain';
const DESCRIPTION =
  'Track DeFi yields across Aave on every supported chain. Live supply and borrow APY, all incentives included. Free Aave portfolio and APY tracker.';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I track DeFi yields across multiple blockchains?',
    a: 'Aave APY aggregates live reserve data from every chain Aave supports — Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, Gnosis, Scroll, Linea, zkSync, BNB Chain, Celo, Sonic, Soneium, Ink, Mantle, and Metis — into a single dashboard. Supply and borrow APYs include all active incentive programs, so you can compare effective yields across chains without manual math.',
  },
  {
    q: 'How do I track my DeFi portfolio on Aave?',
    a: 'Use the portfolio simulator to enter your deposit and borrow positions across any reserve and chain. It calculates your net effective APY, daily earnings, and shows how each incentive program contributes to your yield. Snapshots let you compare scenarios over time.',
  },
  {
    q: 'Is this DeFi yield tracker free?',
    a: 'Yes. Aave APY is a free, public dashboard. No wallet connection or signup required to view live rates, run simulations, or compare opportunities across chains.',
  },
  {
    q: 'How often is the APY data updated?',
    a: 'Reserve rates refresh every minute from the Aave protocol. Incentive forecasts (Merit, Merkl, Brevis) update on their respective campaign cadences and are baked into the effective APY shown on every row.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: TITLE,
      description: DESCRIPTION,
      url: CANONICAL,
      isPartOf: { '@type': 'WebSite', name: 'AAVE APY', url: `${SITE_ORIGIN}/` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

// Derived from SEO_CHAINS so this list cannot drift from the actual /chain/:slug routes.
const CHAINS = SEO_CHAINS.map((c) => ({ slug: c.slug, displayName: c.displayName }));

const DefiYieldTracker = () => {
  return (
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
            <span className="text-foreground">DeFi Yield Tracker</span>
          </nav>

          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              DeFi Yield Tracker for Aave
            </h1>
            <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
              A free DeFi APY tracker covering every Aave market on every supported chain. Live supply and borrow rates, with all active incentive programs included in the effective yield.
            </p>
          </header>

          <Link
            to="/?category=stablecoin"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
          >
            Compare stablecoin yields now
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <section aria-labelledby="what" className="mt-12">
            <h2 id="what" className="text-xl font-semibold mb-3">
              What this Aave portfolio tracker shows
            </h2>
            <ul className="space-y-2">
              {[
                'Live supply and borrow APYs for every Aave reserve across 17 chains',
                'All active incentive programs (Merit, Merkl, Brevis) baked into the effective yield',
                'A portfolio simulator that estimates net effective APY and daily earnings for any combination of positions',
                'An Aave APY tracker with rate simulation — see how your deposit size changes the rate before you commit',
                'An Aave analytics dashboard with utilization, caps, and incentive breakdowns per reserve',
              ].map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden className="text-primary">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="multichain" className="mt-10">
            <h2 id="multichain" className="text-xl font-semibold mb-3">
              Track DeFi yields across multiple blockchains
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Aave is deployed across 17 chains, each with different reserves, incentives, and utilization. A multi-chain DeFi yield tracker is the only way to spot where your capital earns the most after rewards. Browse a chain below or jump straight into the{' '}
              <Link to="/" className="text-primary underline-offset-4 hover:underline">main dashboard</Link>{' '}
              to compare them side by side.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {CHAINS.map((c) => (
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

          <section aria-labelledby="defi-portfolio-tracker" className="mt-10">
            <h2 id="defi-portfolio-tracker" className="text-xl font-semibold mb-3">
              DeFi portfolio tracker
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Unlike generic DeFi portfolio trackers that read your wallet, Aave APY is a focused tracker for Aave positions. Model deposits and borrows across any chain, see the net effective APY after every incentive, and save snapshots to compare over time. Open the{' '}
              <Link to="/?category=stablecoin" className="text-primary underline-offset-4 hover:underline">stablecoin comparison</Link>{' '}
              on the main dashboard to start tracking, or jump into per-chain breakdowns like{' '}
              <Link to="/?chain=ethereum&category=stablecoin" className="text-primary underline-offset-4 hover:underline">Ethereum stables</Link>,{' '}
              <Link to="/?chain=arbitrum&category=eth-related" className="text-primary underline-offset-4 hover:underline">Arbitrum ETH</Link>, and{' '}
              <Link to="/?chain=base&category=stablecoin" className="text-primary underline-offset-4 hover:underline">Base stables</Link>.
            </p>
          </section>

          <section aria-labelledby="aave-portfolio" className="mt-10">
            <h2 id="aave-portfolio" className="text-xl font-semibold mb-3">
              Aave portfolio
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Build an Aave portfolio across any combination of markets and chains. The portfolio panel aggregates supply and borrow positions, computes weighted APY, and highlights which reserves are pulling your yield up or down. Jump into the{' '}
              <Link to="/?category=stablecoin" className="text-primary underline-offset-4 hover:underline">dashboard with stablecoins preselected</Link>{' '}
              to add positions, or explore high-yield chains like{' '}
              <Link to="/?chain=polygon&category=stablecoin" className="text-primary underline-offset-4 hover:underline">Polygon stables</Link>,{' '}
              <Link to="/?chain=avalanche&category=stablecoin" className="text-primary underline-offset-4 hover:underline">Avalanche stables</Link>, and{' '}
              <Link to="/?chain=optimism&category=eth-related" className="text-primary underline-offset-4 hover:underline">Optimism ETH</Link>.
            </p>
          </section>

          <section aria-labelledby="aave-apy-tracker" className="mt-10">
            <h2 id="aave-apy-tracker" className="text-xl font-semibold mb-3">
              Aave APY tracker
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Every reserve includes a live APY tracker with rate simulation — enter a deposit or borrow size and see how the curve responds before you commit on-chain. Incentives from Merit, Merkl, and Brevis are baked into the effective APY shown on every row. Try it on{' '}
              <Link to="/?chain=ethereum" className="text-primary underline-offset-4 hover:underline">Ethereum</Link>,{' '}
              <Link to="/?chain=scroll" className="text-primary underline-offset-4 hover:underline">Scroll</Link>, or{' '}
              <Link to="/?chain=linea" className="text-primary underline-offset-4 hover:underline">Linea</Link>{' '}
              for chain-specific rate breakdowns.
            </p>
          </section>

          <section aria-labelledby="aave-analytics" className="mt-10">
            <h2 id="aave-analytics" className="text-xl font-semibold mb-3">
              Aave analytics
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Beyond rates, Aave APY surfaces analytics that matter for capital deployment: utilization, supply and borrow caps, incentive ceilings, and per-user reward caps. Use the{' '}
              <Link to="/" className="text-primary underline-offset-4 hover:underline">main analytics dashboard</Link>{' '}
              to filter and sort across every chain, or drill into deployments like{' '}
              <Link to="/?chain=sonic" className="text-primary underline-offset-4 hover:underline">Sonic</Link>,{' '}
              <Link to="/?chain=ink" className="text-primary underline-offset-4 hover:underline">Ink</Link>, and{' '}
              <Link to="/?chain=soneium" className="text-primary underline-offset-4 hover:underline">Soneium</Link>.
            </p>
          </section>

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="text-xl font-semibold mb-4">
              Frequently asked questions
            </h2>
            <dl className="space-y-5">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium text-foreground">{f.q}</dt>
                  <dd className="mt-1 text-muted-foreground leading-relaxed">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </>
  );
};

export default DefiYieldTracker;
