import { memo, type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: 'What are incentives (Merit / Merkl / Brevis) and the INK Incentive Calculator?',
    a:
      <div className="space-y-[var(--ds-space-2)]">
        <p>
          Incentives are additional reward programs layered on top of native Aave rates. Merit rewards loyal Aave users, Merkl distributes token incentives for specific markets, and Brevis provides ZK-proof based rewards. Click the incentive badges on any reserve to see details.
        </p>
        <p>
          The INK Incentive Calculator is a special case: it lets you adjust the assumed FDV (Fully Diluted Valuation) of the INK token to see how it affects the incentive APR on Ink-chain markets — drag the slider or enter a value to explore scenarios.
        </p>
      </div>,
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
    q: 'How are Supply APY, Borrow APY and Spread calculated?',
    a:
      <div className="space-y-[var(--ds-space-2)]">
        <p><strong>Borrow APY</strong> follows a piecewise-linear curve based on utilization:</p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px] space-y-[var(--ds-space-1)]">
          <div>U ≤ U<sub>opt</sub>: &nbsp;Borrow APY = baseRate + slope1 × (U / U<sub>opt</sub>)</div>
          <div>U &gt; U<sub>opt</sub>: &nbsp;Borrow APY = baseRate + slope1 + slope2 × (U − U<sub>opt</sub>) / (1 − U<sub>opt</sub>)</div>
        </div>
        <p>
          Each reserve has its own parameters (baseRate, slope1, slope2, optimal utilization) set by Aave governance. Rates stay moderate at normal utilization and spike sharply when liquidity runs tight — this is what drives the scenario simulation.
        </p>
        <p>
          <strong>Supply APY</strong> is whatever borrowers paid, minus the protocol fee, divided across <em>all</em> suppliers (including the liquidity nobody is borrowing):
        </p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px] space-y-[var(--ds-space-1)]">
          <div>Supply APY ≈ Borrow APY × Utilization × (1 − fee)</div>
          <div>Utilization = borrowed / (borrowed + liquidity + deficit)</div>
        </div>
        <p>
          <strong>Spread</strong> is the gap between the two. Without incentives it is always ≤ 0 — suppliers always earn less than borrowers pay:
        </p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          Spread = Supply APY − Borrow APY
        </div>
        <p>What moves Supply APY:</p>
        <ul className="list-disc pl-[var(--ds-space-5)] space-y-[var(--ds-space-1)]">
          <li><strong>Borrow APY</strong> — higher rate means a bigger pot to share, lifting Supply APY.</li>
          <li><strong>Utilization</strong> — the share of supplied money that is actually being borrowed. Unborrowed liquidity earns nothing, so low utilization drags Supply APY down.</li>
          <li><strong>deficit</strong> — bad debt left over after a liquidation (when collateral didn&apos;t cover the loan). It sits in the utilization denominator without paying interest, dragging Utilization — and Supply APY — down. Borrowers still pay full rate; only suppliers are punished.</li>
          <li><strong>fee</strong> — the treasury cut (called <code>reserveFactor</code> in V3, <code>liquidityFee</code> in V4). Higher fee shaves more off the top before suppliers see it.</li>
        </ul>
        <p>
          <strong>V4 twist — risk premium.</strong> In V4, riskier borrowers pay an extra surcharge on top of the headline Borrow APY, so their effective rate is roughly:
        </p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          Effective Borrow APY ≈ Borrow APY × (1 + riskPremium)
        </div>
        <p>
          That extra interest flows back to suppliers, so the more risky borrowing a market has, the tighter (less negative) the spread becomes. In V3 there is no such surcharge.
        </p>
        <p>With incentives, the effective spread can even flip positive:</p>
        <div className="bg-muted/40 rounded-[var(--ds-radius-sm)] px-[var(--ds-space-3)] py-[var(--ds-space-2)] font-mono text-[13px]">
          Effective Spread = (Supply APY + Incentive APR) − Borrow APY
        </div>
        <p>
          When this number is positive, looping (supply → borrow → re-supply) can be profitable — just keep an eye on your liquidation buffer.
        </p>
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
