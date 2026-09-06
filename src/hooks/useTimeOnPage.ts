import { useEffect, useRef } from 'react';
import { trackTimeOnPage } from '@/lib/pageAnalytics';

/**
 * Measures visible time on the page and reports it once when the user leaves
 * (unmount, tab hidden, or page unload). Hidden time is not counted.
 */
export function useTimeOnPage(page: string): void {
  const activeSince = useRef<number | null>(null);
  const accumulated = useRef(0);
  const reported = useRef(false);

  useEffect(() => {
    activeSince.current = Date.now();
    accumulated.current = 0;
    reported.current = false;

    const pause = () => {
      if (activeSince.current !== null) {
        accumulated.current += Date.now() - activeSince.current;
        activeSince.current = null;
      }
    };

    const resume = () => {
      if (activeSince.current === null) activeSince.current = Date.now();
    };

    const report = () => {
      if (reported.current) return;
      pause();
      const seconds = Math.round(accumulated.current / 1000);
      if (seconds > 0) {
        reported.current = true;
        trackTimeOnPage(page, seconds);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        pause();
      } else {
        resume();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', report);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', report);
      report();
    };
  }, [page]);
}
