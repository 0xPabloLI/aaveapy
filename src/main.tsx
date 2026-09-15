import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { preloadDefaultTokenIcon } from '@/lib/preloadUtils';
import { validateApiBaseEnv } from '@/lib/apiBase';
import { bootstrapAnalytics } from '@/lib/consent';

validateApiBaseEnv(import.meta.env);
preloadDefaultTokenIcon();
// Analytics only load for visitors who previously granted consent
// (Consent Mode v2 — see src/lib/consent.ts).
bootstrapAnalytics();

// Error tracking is off the first-paint path by design (dynamic import):
// the SDK chunk loads in parallel with hydration; boot-time errors fall back
// to the error boundary's retry UI. See src/lib/sentry.ts for the setup steps.
void import('@/lib/sentry').then((m) => m.initSentry());

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
