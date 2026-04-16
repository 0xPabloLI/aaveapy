import { memo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS = [
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
    q: 'What is the Spread column?',
    a: 'Spread = Supply APY − Borrow APY. A positive spread means you can earn more by supplying than you pay to borrow the same asset — useful for identifying leverage (looping) opportunities.',
  },
  {
    q: 'How fresh is the data?',
    a: 'The freshness dot on the floating refresh button shows green (fresh), yellow (slightly stale), or red (stale). You can also pull down or click the refresh button to force an update.',
  },
] as const;

const FaqSection = memo(function FaqSection() {
  return (
    <section id="faq" className="border-t border-border/50 pt-[var(--ds-space-6)] pb-[var(--ds-space-2)]">
      <h2 className="ds-text-18 font-semibold text-foreground mb-[var(--ds-space-3)]">
        FAQ
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/40">
            <AccordionTrigger className="ds-text-14 text-foreground hover:no-underline hover:ds-text-brand-cyan gap-[var(--ds-space-3)] text-left">
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
