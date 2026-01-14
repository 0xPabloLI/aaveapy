import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

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
  const controls = useAnimation();

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center"
            style={{ paddingTop: Math.min(pullDistance, PULL_THRESHOLD * 0.8) }}
          >
            <motion.div
              className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg ${
                shouldTrigger || isRefreshing
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground'
              }`}
              style={{
                transform: `rotate(${progress * 360}deg)`,
              }}
              animate={isRefreshing ? { rotate: 360 } : {}}
              transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : 'none',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
