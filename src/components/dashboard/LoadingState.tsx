import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

const LoadingState = () => {
  const isMobile = useIsMobile();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-4)] py-[var(--ds-space-4)] md:py-[var(--ds-space-8)] space-y-4 md:space-y-8">
        <motion.header
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
        >
          <div className="flex items-center gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
            <Skeleton variant="gradient" className="w-12 h-12 md:w-16 md:h-16" />
            <div className="space-y-2">
              <Skeleton variant="gradient" className="h-6 md:h-8 w-40 md:w-52" />
              <Skeleton variant="subtle" className="h-3 md:h-4 w-44 md:w-64 rounded-md" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-[var(--ds-space-2)]">
            <Skeleton variant="subtle" className="w-6 h-6 rounded-md" />
            <Skeleton variant="subtle" className="h-5 w-36 rounded-md" />
          </div>
        </motion.header>

        <motion.div
          className="rounded-xl border border-border/60 bg-card ds-card-pad-sm md:ds-card-pad"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const }}
        >
          <div className="flex items-center justify-between gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
            <div className="flex items-center gap-[var(--ds-space-2)] min-w-0">
              <Skeleton variant="gradient" className="h-5 w-36 rounded-md" />
              <Skeleton variant="subtle" className="w-5 h-5 rounded-full border-border/60" />
            </div>
            <Skeleton variant="subtle" className="h-8 w-24 rounded-lg border-border/60 shrink-0" />
          </div>

          <div className="space-y-[var(--ds-space-2)]">
            <div className="flex items-center gap-[var(--ds-space-2)]">
              <Skeleton variant="subtle" className="h-2.5 w-16 rounded-md" />
              <Skeleton variant="subtle" className="h-2.5 w-14 rounded-md" />
              <Skeleton variant="subtle" className="h-2.5 w-14 rounded-md" />
            </div>
            <Skeleton variant="gradient" className="h-3 w-full rounded-full border-transparent" />
            <div className="flex items-center justify-between gap-[var(--ds-space-2)]">
              {Array.from({ length: isMobile ? 3 : 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="subtle"
                  className={`h-8 rounded-full border-border/60 ${isMobile ? 'w-[30%]' : i === 2 ? 'w-[22%]' : 'w-[18%]'}`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--ds-space-2)] md:gap-[var(--ds-space-4)]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {Array.from({ length: isMobile ? 2 : 4 }).map((_, cardIndex) => (
            <motion.div key={cardIndex} className="glass-card rounded-xl ds-card-pad-sm md:ds-card-pad overflow-hidden" variants={itemVariants}>
              <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
                <Skeleton variant="gradient" className="w-8 h-8 md:w-9 md:h-9 rounded-lg" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton variant="gradient" className={`h-4 md:h-5 ${cardIndex % 2 === 0 ? 'w-16 md:w-28' : 'w-20 md:w-32'}`} />
                  <Skeleton variant="subtle" className="h-2.5 md:h-3 w-20 md:w-36 rounded-md" />
                </div>
              </div>
              <motion.div className="space-y-2" variants={containerVariants} initial="hidden" animate="visible">
                {Array.from({ length: isMobile ? 4 : 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="grid grid-cols-[auto,minmax(0,1fr),auto] grid-rows-[auto,auto] content-center items-center gap-x-[var(--ds-space-1-5)] md:gap-x-[var(--ds-space-2)] gap-y-[var(--ds-space-1)] px-[var(--ds-space-2)] md:px-[var(--ds-space-3)] h-12 md:h-14 rounded-lg border border-border/70 bg-card/45 overflow-hidden"
                    variants={itemVariants}
                  >
                    <Skeleton variant="gradient" className="w-7 h-7 md:w-8 md:h-8 rounded-full row-span-2 border-transparent" />
                    <Skeleton variant={isMobile ? "subtle" : "default"} className={`h-3.5 md:h-4 rounded-md ${i % 2 === 0 ? 'w-8 md:w-14' : 'w-10 md:w-16'}`} />
                    <Skeleton variant="gradient" className={`h-4 md:h-5 justify-self-end rounded-md ${i % 3 === 0 ? 'w-10 md:w-16' : 'w-12 md:w-[4.5rem]'}`} />
                    <div className="flex items-center gap-[var(--ds-space-0-5)] md:gap-[var(--ds-space-1)] min-w-0">
                      <Skeleton variant="subtle" className="w-3.5 h-3.5 rounded-full shrink-0 border-transparent" />
                      <Skeleton variant="subtle" className={`h-2.5 rounded-md ${i % 2 === 0 ? 'w-12 md:w-20' : 'w-10 md:w-[4.5rem]'}`} />
                    </div>
                    <Skeleton variant="subtle" className={`h-2.5 md:h-3 justify-self-end rounded-md ${i % 2 === 0 ? 'w-10 md:w-20' : 'w-8 md:w-16'}`} />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="space-y-2 md:space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="md:hidden">
            <Skeleton variant="subtle" className="h-7 w-28 rounded-lg border-border/60" />
          </div>
          <div className="flex flex-wrap items-center gap-[var(--ds-space-1-5)] md:gap-[var(--ds-space-2)]">
            <Skeleton variant="subtle" className="hidden sm:block h-4 w-12 rounded-md" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                variant={i < 2 ? 'gradient' : 'default'}
                className={`h-7 rounded-md border-border/60 ${i === 0 ? 'w-14' : i === 1 ? 'w-[4.5rem]' : 'w-16'}`}
              />
            ))}
            <Skeleton variant="subtle" className="hidden md:block h-7 w-36 rounded-md ml-auto border-border/60" />
            <Skeleton variant="subtle" className="hidden md:block h-7 w-24 rounded-lg border-border/60" />
          </div>
          <div className="md:hidden">
            <Skeleton variant="subtle" className="h-7 w-full rounded-md border-border/60" />
          </div>
          <div className="flex flex-wrap items-center gap-[var(--ds-space-1)] md:gap-[var(--ds-space-1-5)]">
            <Skeleton variant="subtle" className="hidden sm:block h-4 w-14 rounded-md" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={i}
                variant={i < 3 ? 'gradient' : 'default'}
                className={`h-7 rounded-md border-border/60 ${i === 0 ? 'w-14' : i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`}
              />
            ))}
            <Skeleton variant="subtle" className="h-7 w-16 rounded-md border-dashed border-border/80" />
          </div>
        </motion.div>

        <motion.div
          className="md:hidden space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex justify-between items-center px-[var(--ds-space-1)]">
            <Skeleton variant="subtle" className="h-5 w-24 rounded-md" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="bg-card rounded-xl border border-border/60 ds-card-pad-sm"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between mb-[var(--ds-space-3)]">
                <div className="flex items-center gap-[var(--ds-space-3)]">
                  <Skeleton variant="gradient" className="w-10 h-10 rounded-full border-transparent" />
                  <div className="space-y-1">
                    <Skeleton variant="gradient" className="h-4 w-16 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <Skeleton variant="subtle" className="w-7 h-7 rounded-full border-border/60" />
              </div>
              <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
                <div className="space-y-1">
                  <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                  <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                  <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                </div>
                <div className="space-y-1 items-center flex flex-col">
                  <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                  <Skeleton variant="subtle" className="h-4 w-14 rounded-md" />
                </div>
                <div className="space-y-1 flex flex-col items-end">
                  <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                  <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                  <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="hidden md:block glass-card rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }}
        >
          <div className="p-[var(--ds-space-4)] md:p-[var(--ds-space-6)] border-b border-border/50 flex items-center justify-between gap-[var(--ds-space-3)]">
            <Skeleton variant="gradient" className="h-6 w-24 rounded-md" />
            <Skeleton variant="subtle" className="h-8 w-40 rounded-lg border-border/60" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="h-12 px-[var(--ds-space-3)] text-center w-1/5">
                    <Skeleton variant="subtle" className="h-4 w-14 mx-auto rounded-md" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-3)] text-center w-1/5">
                    <Skeleton variant="subtle" className="h-4 w-14 mx-auto rounded-md" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-3)] text-center w-1/5">
                    <Skeleton variant="gradient" className="h-5 w-24 mx-auto rounded-md" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-3)] text-center w-1/5">
                    <Skeleton variant="subtle" className="h-4 w-14 mx-auto rounded-md" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-3)] text-center w-1/5">
                    <Skeleton variant="gradient" className="h-5 w-24 mx-auto rounded-md" />
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
                {Array.from({ length: 10 }).map((_, i) => (
                  <motion.tr key={i} className="border-b border-border/30" variants={itemVariants}>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-3)]">
                      <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                        <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
                        <Skeleton variant="default" className="h-4 w-14 rounded-md" />
                      </div>
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-3)]">
                      <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-3)]">
                      <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                        <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                        <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                      </div>
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-3)]">
                      <Skeleton variant="subtle" className={`h-5 rounded-md mx-auto ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-3)]">
                      <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                        <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                        <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 3 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingState;
