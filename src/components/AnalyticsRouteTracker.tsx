import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/gtag';

/**
 * Sends a GA4 page_view on every client-side route change.
 * The initial load is already covered by gtag's config call, so we skip it.
 */
export default function AnalyticsRouteTracker() {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
