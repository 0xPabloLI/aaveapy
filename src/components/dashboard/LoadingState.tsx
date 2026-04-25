import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

/* ─── Shared animation config ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

/* ─── Header skeleton ─── */
function HeaderSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <motion.header
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
    >
      <div className="flex items-center gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
        <Skeleton variant="gradient" className="w-12 h-12 md:w-16 md:h-16 rounded-xl" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-[var(--ds-space-2)]">
            <Skeleton variant="gradient" className="h-6 md:h-8 w-28 md:w-36" />
            {isMobile && <Skeleton variant="subtle" className="w-6 h-6 rounded-full" />}
          </div>
          <Skeleton variant="subtle" className="h-3 md:h-4 w-44 md:w-64 rounded-md" />
        </div>
        {isMobile && <Skeleton variant="subtle" className="w-8 h-8 rounded-lg shrink-0" />}
      </div>
      <div className="hidden md:flex items-center gap-[var(--ds-space-3)]">
        <Skeleton variant="subtle" className="w-4 h-4 rounded-md" />
        <Skeleton variant="subtle" className="h-4 w-32 rounded-md" />
        <Skeleton variant="subtle" className="w-8 h-8 rounded-lg" />
      </div>
    </motion.header>
  );
}

/* ─── InkAprCalculator skeleton (collapsible card) ─── */
function InkCalculatorSkeleton() {
  return (
    <motion.div
      className="rounded-xl border border-border/60 bg-card ds-card-pad-sm md:ds-card-pad"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const }}
    >
      <div className="flex items-center justify-between gap-[var(--ds-space-2)]">
        <div className="flex items-center gap-[var(--ds-space-2)] min-w-0">
          <Skeleton variant="gradient" className="h-5 w-36 rounded-md" />
          <Skeleton variant="subtle" className="w-5 h-5 rounded-full" />
        </div>
        <Skeleton variant="subtle" className="h-5 w-5 rounded-md shrink-0" />
      </div>
    </motion.div>
  );
}

/* ─── TopOpportunities skeleton ─── */
function TopOpportunitiesSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <motion.div
      className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--ds-space-2)] md:gap-[var(--ds-space-4)]"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {Array.from({ length: isMobile ? 2 : 4 }).map((_, cardIndex) => (
        <motion.div
          key={cardIndex}
          className="glass-card rounded-xl ds-card-pad-sm md:ds-card-pad overflow-hidden"
          variants={itemVariants}
        >
          {/* Category header: icon + title + subtitle */}
          <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-2)] md:mb-[var(--ds-space-3)]">
            <Skeleton variant="gradient" className="w-8 h-8 md:w-9 md:h-9 rounded-lg" />
            <div className="space-y-1 flex-1 min-w-0">
              <Skeleton variant="gradient" className={`h-4 md:h-5 ${cardIndex % 2 === 0 ? 'w-16 md:w-24' : 'w-20 md:w-28'}`} />
              <Skeleton variant="subtle" className="h-2.5 md:h-3 w-20 md:w-32 rounded-md" />
            </div>
          </div>
          {/* Reserve items: icon + symbol + chain + APY */}
          <div className="space-y-1.5 md:space-y-2">
            {Array.from({ length: isMobile ? 4 : 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto,minmax(0,1fr),auto] grid-rows-[auto,auto] items-center gap-x-[var(--ds-space-1-5)] md:gap-x-[var(--ds-space-2)] gap-y-[var(--ds-space-0-5)] px-[var(--ds-space-2)] md:px-[var(--ds-space-3)] h-12 md:h-14 rounded-lg border border-border/70 bg-card/45 overflow-hidden"
              >
                <Skeleton variant="gradient" className="w-7 h-7 md:w-8 md:h-8 rounded-full row-span-2 border-transparent" />
                <Skeleton variant={isMobile ? 'subtle' : 'default'} className={`h-3.5 md:h-4 rounded-md ${i % 2 === 0 ? 'w-8 md:w-14' : 'w-10 md:w-16'}`} />
                <Skeleton variant="gradient" className={`h-4 md:h-5 justify-self-end rounded-md ${i % 3 === 0 ? 'w-10 md:w-16' : 'w-12 md:w-[4.5rem]'}`} />
                <div className="flex items-center gap-[var(--ds-space-0-5)] md:gap-[var(--ds-space-1)] min-w-0">
                  <Skeleton variant="subtle" className="w-3.5 h-3.5 rounded-full shrink-0 border-transparent" />
                  <Skeleton variant="subtle" className={`h-2.5 rounded-md ${i % 2 === 0 ? 'w-12 md:w-20' : 'w-10 md:w-[4.5rem]'}`} />
                </div>
                <Skeleton variant="subtle" className={`h-2.5 md:h-3 justify-self-end rounded-md ${i % 2 === 0 ? 'w-10 md:w-20' : 'w-8 md:w-16'}`} />
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── FilterBar skeleton ─── */
function FilterBarSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <motion.div
      className="space-y-2 md:space-y-2.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.4 }}
    >
      {/* Row 1: Token categories + search + APR/APY */}
      <div className="flex flex-wrap items-center gap-[var(--ds-space-1-5)] md:gap-[var(--ds-space-2)]">
        <Skeleton variant="subtle" className="hidden sm:block h-4 w-12 rounded-md" />
        {['All', 'Stables', 'ETH', 'BTC', 'Pendle'].map((_, i) => (
          <Skeleton
            key={i}
            variant={i === 0 ? 'gradient' : 'default'}
            className={`h-7 rounded-md border-border/60 ${i === 0 ? 'w-10' : i === 1 ? 'w-14' : 'w-10'}`}
          />
        ))}
        <Skeleton variant="subtle" className="hidden md:block h-7 w-36 rounded-md ml-1 border-border/60" />
        <div className="hidden md:block flex-1 min-w-4" />
        <Skeleton variant="subtle" className="hidden md:block h-7 w-24 rounded-lg border-border/60" />
      </div>
      {/* Row 2 mobile: search + APR/APY */}
      {isMobile && (
        <div className="flex items-center gap-1.5">
          <Skeleton variant="subtle" className="h-7 flex-1 rounded-md border-border/60" />
          <Skeleton variant="subtle" className="h-7 w-20 rounded-lg border-border/60 shrink-0" />
        </div>
      )}
      {/* Row 3: Markets */}
      <div className="flex flex-wrap items-center gap-[var(--ds-space-1)] md:gap-[var(--ds-space-1-5)]">
        <Skeleton variant="subtle" className="hidden sm:block h-4 w-14 rounded-md" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            variant={i === 0 ? 'gradient' : 'default'}
            className={`h-7 rounded-md border-border/60 ${i === 0 ? 'w-10' : i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ─── ScenarioControls skeleton ─── */
function ScenarioControlsSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* USD/Token segmented */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <Skeleton variant="subtle" className="h-7 w-10 rounded-md" />
            <Skeleton variant="subtle" className="h-7 w-10 rounded-md" />
          </div>
          {/* Supply + Borrow inputs */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Skeleton variant="gradient" className="h-3 w-11 rounded-md shrink-0" />
              <Skeleton variant="subtle" className="h-9 flex-1 rounded-md" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton variant="gradient" className="h-3 w-11 rounded-md shrink-0" />
              <Skeleton variant="subtle" className="h-9 flex-1 rounded-md" />
            </div>
          </div>
          {/* Clear + settings */}
          <Skeleton variant="subtle" className="w-8 h-8 rounded-md shrink-0" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full rounded-xl bg-card/60 px-3 py-0.5 backdrop-blur-sm">
      <div className="flex w-full items-center gap-3">
        <div className="flex shrink-0 items-center gap-0.5">
          <Skeleton variant="subtle" className="h-8 w-12 rounded-md" />
          <Skeleton variant="subtle" className="h-8 w-14 rounded-md" />
        </div>
        <Skeleton variant="gradient" className="h-3 w-12 rounded-md shrink-0" />
        <Skeleton variant="subtle" className="h-8 flex-1 min-w-[6rem] rounded-md" />
        <Skeleton variant="gradient" className="h-3 w-12 rounded-md shrink-0" />
        <Skeleton variant="subtle" className="h-8 flex-1 min-w-[6rem] rounded-md" />
        <Skeleton variant="subtle" className="h-4 w-36 rounded-md shrink-0" />
        <Skeleton variant="subtle" className="h-8 w-16 rounded-md shrink-0" />
      </div>
    </div>
  );
}

/* ─── Mobile reserve card skeleton (matches actual card: header + tabs + hero APY + spread) ─── */
function MobileCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/60 py-3">
      {/* Token header: icon + symbol/chain + utilization */}
      <div className="flex items-center gap-[var(--ds-space-2)] mb-1.5 min-h-[36px] px-3">
        <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton variant="gradient" className="h-3.5 w-12 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton variant="subtle" className="w-3 h-3 rounded-full shrink-0 border-transparent" />
            <Skeleton variant="subtle" className="h-2.5 w-16 rounded-md" />
          </div>
        </div>
        <Skeleton variant="subtle" className="h-5 w-10 rounded-md shrink-0" />
      </div>
      {/* Pill tabs: Supply | Borrow */}
      <div className="mx-3 mb-1.5 flex gap-[var(--ds-space-1)] rounded-lg bg-muted/40 p-0.5">
        <Skeleton variant="gradient" className="flex-1 h-6 rounded-md" />
        <Skeleton variant="subtle" className="flex-1 h-6 rounded-md" />
      </div>
      {/* Amount row */}
      <div className="flex items-center gap-1.5 px-4 mb-1">
        <Skeleton variant="subtle" className="h-2.5 w-10 rounded-md" />
        <div className="ml-auto flex items-center gap-1">
          <Skeleton variant="gradient" className="h-3.5 w-14 rounded-md" />
          <Skeleton variant="subtle" className="w-3 h-3 rounded-full border-transparent" />
        </div>
      </div>
      {/* Hero APY */}
      <div className="flex flex-col items-center gap-1 mt-1">
        <Skeleton variant="gradient" className="h-7 w-20 rounded-md" />
        <div className="flex items-center gap-1">
          <Skeleton variant="subtle" className="h-3 w-10 rounded-md" />
          <Skeleton variant="subtle" className="h-3 w-2 rounded-md" />
          <Skeleton variant="gradient" className="h-3 w-12 rounded-full" />
        </div>
      </div>
      {/* Spread toggle */}
      <div className="mt-1.5 px-3">
        <Skeleton variant="subtle" className="h-8 w-full rounded-lg border-border/60" />
      </div>
    </div>
  );
}

/* ─── Mobile reserves section skeleton ─── */
function MobileReservesSkeleton() {
  return (
    <motion.div
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <ScenarioControlsSkeleton isMobile />
      {/* Sort header */}
      <div className="flex justify-between items-center px-[var(--ds-space-1)]">
        <Skeleton variant="subtle" className="h-4 w-24 rounded-md" />
        <div className="flex items-center gap-[var(--ds-space-1-5)]">
          <Skeleton variant="subtle" className="h-6 w-12 rounded-lg" />
          <Skeleton variant="gradient" className="h-6 w-14 rounded-lg" />
          <Skeleton variant="subtle" className="h-6 w-14 rounded-lg" />
          <Skeleton variant="subtle" className="h-6 w-14 rounded-lg" />
        </div>
      </div>
      {/* 2x2 grid of cards */}
      <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div key={i} variants={itemVariants}>
            <MobileCardSkeleton />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Desktop table skeleton (8 columns matching actual) ─── */
function DesktopTableSkeleton() {
  return (
    <motion.div
      className="relative min-w-0 w-full rounded-2xl bg-border/60 p-px shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }}
    >
      <div className="min-w-0 w-full overflow-visible rounded-[calc(1rem-1px)] bg-card">
        {/* ScenarioControls */}
        <div className="rounded-t-[calc(1rem-1px)] border-b border-border/60 bg-card p-[var(--ds-space-3)]">
          <ScenarioControlsSkeleton isMobile={false} />
        </div>
        {/* Table */}
        <table className="w-full table-fixed min-w-0">
          <colgroup>
            {/* Order: Token → Market → Price → Size → Util → Supply → Spread → Borrow
             * Widths must mirror ReservesTable.tsx exactly. */}
            <col style={{ width: '14%' }} />
            <col style={{ width: '14.5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border/60">
              {['Token', 'Market', 'Price', 'Size', 'Util', 'Supply', 'Spread', 'Borrow'].map((label, i) => (
                <th key={label} className="py-[var(--ds-space-3)] text-center">
                  <Skeleton
                    variant={i === 5 || i === 7 ? 'gradient' : 'subtle'}
                    className={`h-5 mx-auto rounded-md ${i === 3 ? 'w-16' : i === 4 ? 'w-20' : 'w-14'}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.tr key={i} className="border-b border-border/30" variants={itemVariants}>
                {/* Token: icon + symbol (left-aligned) */}
                <td className="ds-reserves-cell-td-edge-l py-[var(--ds-space-3)]">
                  <div className="flex items-center justify-start gap-[var(--ds-space-2)]">
                    <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
                    <Skeleton variant="default" className={`h-4 rounded-md ${i % 2 === 0 ? 'w-10' : 'w-14'}`} />
                  </div>
                </td>
                {/* Market: chain chip (centered) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
                </td>
                {/* Price (right-aligned) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <Skeleton variant="subtle" className={`h-4 ml-auto rounded-md ${i % 2 === 0 ? 'w-14' : 'w-10'}`} />
                </td>
                {/* Size: supply + borrow stacked (right-aligned) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <div className="flex flex-col items-end gap-[var(--ds-space-0-5)]">
                    <Skeleton variant="gradient" className={`h-4 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
                    <Skeleton variant="subtle" className={`h-4 rounded-md ${i % 2 === 0 ? 'w-14' : 'w-16'}`} />
                  </div>
                </td>
                {/* Utilization (right-aligned) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <div className="flex items-center justify-end gap-1">
                    <Skeleton variant="subtle" className="w-2 h-4 rounded-sm border-transparent" />
                    <Skeleton variant="subtle" className="h-4 w-10 rounded-md" />
                  </div>
                </td>
                {/* Supply: total + native+incentive breakdown (right-aligned) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <div className="flex flex-col items-end gap-[var(--ds-space-0-5)]">
                    <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-14' : 'w-16'}`} />
                    <div className="flex items-center gap-1">
                      <Skeleton variant="subtle" className="h-3 w-8 rounded-md" />
                      <Skeleton variant="subtle" className="h-3 w-10 rounded-full" />
                    </div>
                  </div>
                </td>
                {/* Spread (right-aligned) */}
                <td className="ds-reserves-cell-td py-[var(--ds-space-3)]">
                  <Skeleton variant="subtle" className={`h-5 rounded-md ml-auto ${i % 2 === 0 ? 'w-14' : 'w-12'}`} />
                </td>
                {/* Borrow: total + native+incentive breakdown (right-aligned) */}
                <td className="ds-reserves-cell-td-edge-r py-[var(--ds-space-3)]">
                  <div className="flex flex-col items-end gap-[var(--ds-space-0-5)]">
                    <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-14' : 'w-16'}`} />
                    <div className="flex items-center gap-1">
                      <Skeleton variant="subtle" className="h-3 w-8 rounded-md" />
                      <Skeleton variant="subtle" className="h-3 w-10 rounded-full" />
                    </div>
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ─── Main LoadingState ─── */
const LoadingState = () => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-4)] py-[var(--ds-space-3)] md:py-[var(--ds-space-5)] space-y-3 md:space-y-5">
        <HeaderSkeleton isMobile={!!isMobile} />
        <InkCalculatorSkeleton />
        <TopOpportunitiesSkeleton isMobile={!!isMobile} />
        <div className="space-y-2 md:space-y-3">
          <FilterBarSkeleton isMobile={!!isMobile} />
          {isMobile ? <MobileReservesSkeleton /> : <DesktopTableSkeleton />}
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
