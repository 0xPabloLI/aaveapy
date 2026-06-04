import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import LoadingState from "@/components/dashboard/LoadingState";
import { fetchMarkets } from "@/hooks/useAaveMarkets";
import { fetchSideDataMeta, SIDE_DATA_META_QUERY_KEY } from "@/hooks/useSideDataMeta";
import { QUERY_STALE_TIMES } from "@/config/queryStaleTimes";
import { clearLegacyCacheEntries } from "@/lib/cache";
import { wagmiConfig } from "@/lib/wagmi/config";
import { AaveProviders } from "@/providers/AaveProviders";
import { SdkErrorBoundary } from "@/providers/SdkErrorBoundary";
import "@/i18n";

// Lazy load route components
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChainPage = lazy(() => import("./pages/ChainPage"));
const LandingPT = lazy(() => import("./pages/LandingPT"));
const LandingFR = lazy(() => import("./pages/LandingFR"));
const LandingTR = lazy(() => import("./pages/LandingTR"));
const AdminSeo = lazy(() => import("./pages/AdminSeo"));
const AdminAaveNewsBacklinks = lazy(() => import("./pages/AdminAaveNewsBacklinks"));
const DefiYieldTracker = lazy(() => import("./pages/DefiYieldTracker"));
const AssetPage = lazy(() => import("./pages/AssetPage"));
const UsaStablecoinApy = lazy(() => import("./pages/UsaStablecoinApy"));
const PortfolioMergeProtoPage = lazy(() => import("./pages/PortfolioMergeProto"));

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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{ lightMode: lightTheme(), darkMode: darkTheme() }}
          modalSize="compact"
        >
          <SdkErrorBoundary>
            <AaveProviders>
            <TooltipProvider delayDuration={200}>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_relativeSplatPath: true }}>
              <Suspense fallback={<LoadingState />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/chain/:slug" element={<ChainPage />} />
                  <Route path="/pt-br" element={<LandingPT />} />
                  <Route path="/fr" element={<LandingFR />} />
                  <Route path="/tr" element={<LandingTR />} />
                  <Route path="/admin/seo" element={<AdminSeo />} />
                  <Route path="/admin/aave-news-backlinks" element={<AdminAaveNewsBacklinks />} />
                  <Route path="/defi-yield-tracker" element={<DefiYieldTracker />} />
                  <Route path="/asset/:slug" element={<AssetPage />} />
                  <Route path="/usa-stablecoin-apy" element={<UsaStablecoinApy />} />
                  {/* PROTOTYPE — delete after PortfolioMerge decision */}
                  <Route path="/prototype/portfolio-merge" element={<PortfolioMergeProtoPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
            </AaveProviders>
          </SdkErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ThemeProvider>
);

export default App;
