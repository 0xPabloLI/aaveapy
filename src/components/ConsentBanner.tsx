import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { getConsent, setConsent } from '@/lib/consent';

/**
 * Analytics consent banner (GDPR/CCPA) — GA4 Consent Mode v2.
 * Rendered once per visitor until a decision is stored; both choices dismiss
 * the banner. Warm, quiet surface: informative, never blocking the data.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Decide after mount so SSR/tests and first-paint are banner-free.
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  const decide = (analytics: 'granted' | 'denied') => {
    setConsent(analytics);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4"
    >
      <div className="flex w-full max-w-3xl flex-col gap-3 rounded-md border border-border bg-card/95 p-3 text-sm shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <div className="flex items-start gap-2 text-foreground">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-left leading-snug text-foreground/90">
            AaveAPY uses Google Analytics to understand which chains and markets are visited. Data is aggregated and
            never identifies you. You choose whether to allow it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => decide('denied')}
            className="rounded-button border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            <X className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide('granted')}
            className="rounded-button bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
