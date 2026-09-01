import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import LoadingState from "@/components/dashboard/LoadingState";
import { fetchMarkets } from "@/hooks/useAaveMarkets";
import { fetchSideDataMeta, SIDE_DATA_META_QUERY_KEY } from "@/hooks/useSideDataMeta";
import { QUERY_STALE_TIMES } from "@/config/queryStaleTimes";
import { clearLegacyCacheEntries } from "@/lib/cache";
// The wallet layer (wagmi + RainbowKit → vendor-blockchain, ~420 KB gzip) and
// the Aave SDK (@aave/react + @aave-dao → vendor-aave, ~218 KB gzip) must stay
// off the entry chunk's synchronous import graph: first paint renders after
// entry + first-paint whitelist chunks only, while these chunks stream in.
// Both lazy boundaries fall back to LoadingState (not null) so the two-stage
// load never flashes a blank screen.
// SdkErrorBoundary (no viem/wagmi deps) wraps the lazy providers so a chunk
// load failure degrades gracefully instead of white-screening.
const WalletProviders = lazy(() => import("@/providers/WalletProviders").then(m => ({ default: m.WalletProviders })));
const AaveProviders = lazy(() => import("@/providers/AaveProviders").then(m => ({ default: m.AaveProviders })));
import { SdkErrorBoundary } from "@/providers/SdkErrorBoundary";
import AnalyticsRouteTracker from "@/components/AnalyticsRouteTracker";

import "@/i18n";

// Lazy load route components
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChainPage = lazy(() => import("./pages/ChainPage"));
const LandingPT = lazy(() => import("./pages/LandingPT"));
const AaveTaxasApyPT = lazy(() => import("./pages/AaveTaxasApyPT"));
const LandingFR = lazy(() => import("./pages/LandingFR"));
const LandingTR = lazy(() => import("./pages/LandingTR"));
const AdminSeo = lazy(() => import("./pages/AdminSeo"));
const AdminAaveNewsBacklinks = lazy(() => import("./pages/AdminAaveNewsBacklinks"));
const DefiYieldTracker = lazy(() => import("./pages/DefiYieldTracker"));
const AssetPage = lazy(() => import("./pages/AssetPage"));
const UsaStablecoinApy = lazy(() => import("./pages/UsaStablecoinApy"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIMES.default,
    },
  },
});

if (typeof window !== 'undefined') {
  clearLegacyCacheEntries();
}

// Prefetch critical data immediately on app load
// This starts fetching before React components mount
queryClient.prefetchQuery({
  queryKey: ['aave-markets'],
  queryFn: fetchMarkets,
  staleTime: QUERY_STALE_TIMES.coreSnapshotApi,
});

// Prefetch side-data (includes forecast, categories, FDV) alongside markets
queryClient.prefetchQuery({
  queryKey: SIDE_DATA_META_QUERY_KEY,
  queryFn: fetchSideDataMeta,
  staleTime: QUERY_STALE_TIMES.sideDataMeta,
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
    <Analytics debug={false} />
    <SpeedInsights debug={false} />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Toaster />
        <Sonner />
        <SdkErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <WalletProviders>
              <Suspense fallback={<LoadingState />}>
                <AaveProviders>
                  <BrowserRouter>
                    <AnalyticsRouteTracker />
                    <Suspense fallback={<LoadingState />}>
                      <Routes>

                        <Route path="/" element={<Index />} />
                        <Route path="/chain/:slug" element={<ChainPage />} />
                        <Route path="/pt-br" element={<LandingPT />} />
                        <Route path="/pt-br/taxas-aave-apy" element={<AaveTaxasApyPT />} />
                        <Route path="/fr" element={<LandingFR />} />
                        <Route path="/tr" element={<LandingTR />} />
                        <Route path="/admin/seo" element={<AdminSeo />} />
                        <Route path="/admin/aave-news-backlinks" element={<AdminAaveNewsBacklinks />} />
                        <Route path="/defi-yield-tracker" element={<DefiYieldTracker />} />
                        <Route path="/asset/:slug" element={<AssetPage />} />
                        <Route path="/usa-stablecoin-apy" element={<UsaStablecoinApy />} />

                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
                </AaveProviders>
              </Suspense>
            </WalletProviders>
          </Suspense>
        </SdkErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
