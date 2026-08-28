import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleHead } from "@/components/seo/LocaleHead";
import { LOCALE_PATH_MAP, SITE_ORIGIN, type SupportedLocale } from "@/i18n";

interface LandingFaq {
  q: string;
  a: string;
}
interface LandingFeature {
  title: string;
  body: string;
}
interface LandingContent {
  meta: { title: string; description: string; ogLocale: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; secondaryCta: string };
  trustBar: string[];
  features: LandingFeature[];
  faqs: LandingFaq[];
}

interface LocalizedLandingProps {
  locale: Exclude<SupportedLocale, "en">;
  content: LandingContent;
  /** Optional in-locale related pages rendered under the FAQ. */
  relatedLinks?: Array<{ to: string; label: string }>;
}

export function LocalizedLanding({ locale, content, relatedLinks }: LocalizedLandingProps) {
  const path = `/${LOCALE_PATH_MAP[locale]}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <LocaleHead
        locale={locale}
        path={path}
        title={content.meta.title}
        description={content.meta.description}
        ogLocale={content.meta.ogLocale}
        jsonLd={faqJsonLd}
      />
      <main className="min-h-screen bg-background text-foreground">
        {/* HERO */}
        <section className="container mx-auto px-4 pt-16 pb-12 sm:pt-24 sm:pb-20 max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            {content.hero.eyebrow}
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] gradient-text">
            {content.hero.title}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {content.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/">
                {content.hero.cta}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl">
              <Link to="/chain/ethereum">{content.hero.secondaryCta}</Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {content.trustBar.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* FEATURES */}
        <section className="container mx-auto px-4 pb-16 max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/60 bg-card p-6"
              >
                <h2 className="text-base font-semibold text-foreground">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-4 pb-20 max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">FAQ</h2>
          <div className="space-y-3">
            {content.faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-border/60 bg-card p-5 open:bg-card"
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

        {relatedLinks && relatedLinks.length > 0 && (
          <nav
            aria-label="Related pages"
            className="container mx-auto px-4 pb-10 max-w-3xl text-sm text-muted-foreground"
          >
            {relatedLinks.map((l, i) => (
              <span key={l.to}>
                {i > 0 && " · "}
                <Link to={l.to} className="text-secondary hover:underline">
                  {l.label}
                </Link>
              </span>
            ))}
          </nav>
        )}

        {/* FOOTER CTA */}
        <section className="container mx-auto px-4 pb-24 max-w-5xl">
          <div className="rounded-2xl border border-border/60 bg-card p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight gradient-text">
              {content.hero.title}
            </h2>
            <div className="mt-6">
              <Button asChild size="lg" className="rounded-xl">
                <Link to="/">
                  {content.hero.cta}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {SITE_ORIGIN.replace("https://", "")}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
