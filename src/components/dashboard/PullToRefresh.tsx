import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 80;
const RESISTANCE_FACTOR = 0.4;

const PullToRefresh = ({ onRefresh, children, disabled = false }: PullToRefreshProps) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && window.scrollY <= 0) {
      e.preventDefault();
      const distance = Math.min(diff * RESISTANCE_FACTOR, PULL_THRESHOLD * 1.5);
      setPullDistance(distance);
    }
  }, [isPulling, disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldTrigger = pullDistance >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-safe"
            style={{ paddingTop: Math.max(12, Math.min(pullDistance, PULL_THRESHOLD * 0.8)) }}
          >
            <motion.div
              className={`flex items-center justify-center w-[var(--ds-button-lg-h)] h-[var(--ds-button-lg-h)] rounded-full shadow-lg border-2 transition-all duration-200 ${
                shouldTrigger || isRefreshing
                  ? 'ds-bg-emerald-500-20 ds-text-emerald-600 ds-border-emerald-200 shadow-[0_0_16px_rgb(var(--ds-emerald-500-rgb)/0.25)]'
                  : 'bg-card text-muted-foreground border-border shadow-md'
              }`}
              initial={false}
              animate={{
                scale: shouldTrigger || isRefreshing ? 1.05 : 1,
                rotate: isRefreshing ? 360 : progress * 360,
              }}
              transition={
                isRefreshing 
                  ? { rotate: { repeat: Infinity, duration: 0.8, ease: 'linear' } }
                  : { type: 'spring', stiffness: 200, damping: 15 }
              }
            >
              <RefreshCw className="w-5 h-5" />
            </motion.div>
            {/* Progress indicator text */}
            {isRefreshing && (
              <motion.span 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-full mt-2 ds-text-11 text-muted-foreground font-medium"
              >
                Refreshing...
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div
        style={pullDistance > 0 ? {
          transform: `translateY(${pullDistance * 0.3}px)`,
          transition: 'transform 0.15s ease-out',
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
