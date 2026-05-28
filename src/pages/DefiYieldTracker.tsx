import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, HelpCircle } from 'lucide-react';
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
    q: 'What is DeFi yield farming?',
    a: 'DeFi yield farming is the practice of depositing crypto assets into decentralized protocols to earn interest or rewards. On Aave, yield farming works by supplying liquidity to lending pools; borrowers pay interest, and suppliers earn a share of it. Additional reward programs like Merit, Merkl, and Brevis can boost the effective yield beyond the base rate.',
  },
  {
    q: 'What are the best stablecoin APY rates today?',
    a: 'Stablecoin APYs change minute to minute based on pool utilization and active incentives. USDC and USDT on L2s like Base, Arbitrum, and Polygon often offer the most competitive effective APYs once Merit and Merkl rewards are included. Use the dashboard to compare live stablecoin APYs across all 17 chains side by side.',
  },
  {
    q: 'How does crypto staking work on DeFi platforms?',
    a: 'Crypto staking in DeFi typically means locking assets in a protocol to earn yield. On Aave, "staking" takes the form of supplying assets to liquidity pools — there is no lockup, and you earn a supply APY proportional to borrower demand. Unlike proof-of-stake staking, DeFi staking rewards come from interest paid by borrowers, plus any incentive tokens.',
  },
  {
    q: 'What is the best DeFi staking platform?',
    a: 'The best DeFi staking platform depends on your assets and risk tolerance. Aave is one of the largest and most audited lending protocols, with markets on 17 chains. Aave APY helps you compare Aave yields across chains so you can find the best rate for your stablecoins, ETH, or BTC without switching between dApps.',
  },
  {
    q: 'What are DeFi lending rates and how are they set?',
    a: "DeFi lending rates are set algorithmically based on pool utilization — the ratio of borrowed assets to supplied assets. When utilization is low, rates stay moderate; when liquidity runs tight, rates spike sharply to attract new deposits. Aave governance sets each pool's base rate, slope parameters, and optimal utilization point, which together define the rate curve.",
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

function faqSlug(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 64);
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': CANONICAL,
      name: TITLE,
      description: DESCRIPTION,
      url: CANONICAL,
      isPartOf: { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/`, name: 'AAVE APY', url: `${SITE_ORIGIN}/` },
      inLanguage: 'en',
    },
    {
      '@type': 'FAQPage',
      '@id': `${CANONICAL}#faq`,
      url: CANONICAL,
      mainEntity: FAQS.map((f) => {
        const slug = faqSlug(f.q);
        return {
          '@type': 'Question',
          '@id': `${CANONICAL}#${slug}`,
          url: `${CANONICAL}#${slug}`,
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            '@id': `${CANONICAL}#${slug}-answer`,
            text: f.a,
            inLanguage: 'en',
          },
        };
      }),
    },
  ],
};

// Derived from SEO_CHAINS so this list cannot drift from the actual /chain/:slug routes.
const CHAINS = SEO_CHAINS.map((c) => ({ slug: c.slug, displayName: c.displayName }));

const DefiYieldTracker = () => {
  const faqRef = useRef<HTMLElement | null>(null);
  const faqHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [faqInView, setFaqInView] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#faq') {
      faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => faqHeadingRef.current?.focus(), 600);
    }
  }, []);

  useEffect(() => {
    const el = faqRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setFaqInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleJumpToFaq = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof history !== 'undefined') history.replaceState(null, '', '#faq');
    setTimeout(() => faqHeadingRef.current?.focus(), 600);
  };

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

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/?category=stablecoin"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-medium ring-1 ring-border hover:ring-2 transition-all"
            >
              Compare stablecoin yields now
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="#faq"
              onClick={handleJumpToFaq}
              aria-label="Jump to frequently asked questions"
              className="inline-flex items-center gap-2 rounded-xl bg-card px-5 py-3 font-medium text-foreground ring-1 ring-border hover:ring-2 transition-all"
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
              Jump to FAQ
            </a>
          </div>


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

          <section
            ref={faqRef}
            aria-labelledby="faq"
            className="relative mt-12 scroll-mt-20 rounded-xl"
          >
            <div
              className={`pointer-events-none absolute inset-0 rounded-xl transition-all duration-700 ease-out ${
                faqInView
                  ? 'opacity-100 scale-[1.015] shadow-[0_0_40px_-8px_hsl(var(--primary)/0.25)] ring-2 ring-primary/50 bg-primary/[0.05]'
                  : 'opacity-0 scale-100 ring-0 shadow-none'
              }`}
              aria-hidden="true"
            />
            <div className="relative p-4 -m-4">
              <h2 id="faq" className="text-xl font-semibold mb-4">
                Frequently asked questions
              </h2>
              <dl className="space-y-5">
                {FAQS.map((f) => (
                  <div key={f.q} id={faqSlug(f.q)}>
                    <dt className="font-medium text-foreground">{f.q}</dt>
                    <dd className="mt-1 text-muted-foreground leading-relaxed">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default DefiYieldTracker;
