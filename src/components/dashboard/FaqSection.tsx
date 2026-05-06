import { memo, type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: 'What is the INK Incentive Calculator?',
    a: 'It lets you adjust the assumed FDV (Fully Diluted Valuation) of the INK token to see how it affects the incentive APR on Ink-chain markets. Drag the slider or enter a value to explore scenarios.',
  },
  {
    q: 'What are incentives (Merit / Merkl / Brevis)?',
    a: 'These are additional reward programs on top of native Aave rates. Merit rewards loyal Aave users, Merkl distributes token incentives for specific markets, and Brevis provides ZK-proof based rewards. Click the incentive badges on any reserve to see details.',
  },
  {
    q: 'How does the Scenario Simulation work?',
    a: 'Click any reserve row to expand it, then enter a hypothetical supply or borrow amount. The simulator recalculates interest rates based on the new utilization, showing you how your deposit/borrow would shift the market rate.',
  },
  {
    q: 'What is APY vs APR?',
    a: 'APR (Annual Percentage Rate) is the simple interest rate. APY (Annual Percentage Yield) includes compound interest. You can toggle between them using the APY/APR switch in the filter bar.',
  },
  {
    q: 'How do I filter by chain or token type?',
    a: 'Use the category buttons (All / Stable / ETH / BTC / Pendle) to filter by asset type. Use the market chips below to filter by specific Aave deployments (Ethereum, Arbitrum, Base, etc.).',
  },
  {
    q: 'How is Borrow APY determined?',
    a:
      <div className="space-y-[var(--ds-space-2)]">
        <p>Borrow APY follows a piecewise-linear curve based on utilization:</p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px] space-y-[var(--ds-space-1)]">
          <div>U ≤ U<sub>opt</sub>: &nbsp;Borrow APY = baseRate + slope1 × (U / U<sub>opt</sub>)</div>
          <div>U &gt; U<sub>opt</sub>: &nbsp;Borrow APY = baseRate + slope1 + slope2 × (U − U<sub>opt</sub>) / (1 − U<sub>opt</sub>)</div>
        </div>
        <p>Each reserve has its own parameters (baseRate, slope1, slope2, optimal utilization) configured by Aave governance. Rates stay moderate at normal utilization and spike sharply when liquidity runs tight — this is what drives the scenario simulation.</p>
      </div>,
  },
  {
    q: 'What is the Spread column?',
    a:
      <div className="space-y-[var(--ds-space-2)]">
        <p>Spread = Supply APY − Borrow APY</p>
        <p>Spread is always ≤ 0 without incentives: the protocol takes a cut of borrower interest, so suppliers always earn less than borrowers pay. The formula:</p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          Supply APY = Borrow APY × U × (1 − protocolFee)
        </div>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          U = (borrowed + riskPremium) / (borrowed + liquidity + deficit)
        </div>
        <p>Drivers:</p>
        <ul className="list-disc pl-[var(--ds-space-5)] space-y-[var(--ds-space-1)]">
          <li>Borrow APY — rate curve (see FAQ above)</li>
          <li>deficit — bad debt inflates the denominator → ↓U → wider spread</li>
          <li>riskPremium — risk premium (V4) adds yield to the numerator → ↑U → tighter spread. In V3, riskPremium = 0.</li>
          <li>protocolFee — treasury cut (called reserveFactor in V3, liquidityFee in V4) → ↑ widens spread</li>
        </ul>
        <p>With incentives spread can turn positive:</p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          Effective Spread = (Supply APY + Incentive APR) − Borrow APY
        </div>
      </div>,
  },
  {
    q: 'How fresh is the data?',
    a: 'The freshness dot on the floating refresh button shows green (fresh), yellow (slightly stale), or red (stale). You can also pull down or click the refresh button to force an update.',
  },
];

const FaqSection = memo(function FaqSection() {
  return (
    <section id="faq" className="border-t border-border/50 pt-[var(--ds-space-6)] pb-[var(--ds-space-2)]">
      <h2 className="ds-text-18 font-semibold text-foreground mb-[var(--ds-space-3)]">
        FAQ
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/40">
            <AccordionTrigger className="ds-text-14 text-foreground hover:no-underline hover-gradient-text open-gradient-text gap-[var(--ds-space-3)] text-left">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="ds-text-14 text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
});

export default FaqSection;
