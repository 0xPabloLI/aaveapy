import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  children: React.ReactNode;
  surfaceStyle?: React.CSSProperties;
  showShadow?: boolean;
  overlayOpacity?: string;
  animate?: boolean;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  titleId,
  children,
  surfaceStyle,
  showShadow = false,
  overlayOpacity = '40',
  animate = false,
}: BottomSheetProps) {
  const overlayOpacityValue = parseInt(overlayOpacity, 10) / 100;
  const overlay = (
    <div
      className="fixed inset-0 z-30"
      style={{ backgroundColor: `hsl(var(--background) / ${overlayOpacityValue})` }}
      onClick={onClose}
      aria-hidden="true"
    />
  );

  const sheet = (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card max-h-[80vh] overflow-y-auto',
        showShadow && 'ds-tooltip-shadow-up',
      )}
      role="dialog"
      aria-modal="true"
      {...(titleId ? { 'aria-labelledby': titleId } : {})}
      style={surfaceStyle}
    >
      <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] flex items-center justify-between z-10">
        <h3 id={titleId} className="ds-tooltip-title text-foreground">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-[var(--ds-space-1-5)] rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="px-[var(--ds-space-3)] pt-[var(--ds-space-2)] pb-[var(--ds-space-2)]">
        {children}
      </div>
    </div>
  );

  if (!open) return null;

  if (animate) {
    return (
      <AnimatePresence>
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {overlay}
          </motion.div>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            {sheet}
          </motion.div>
        </>
      </AnimatePresence>
    );
  }

  return (
    <>
      {overlay}
      {sheet}
    </>
  );
}
