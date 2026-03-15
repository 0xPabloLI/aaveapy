import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import LoadingState from "@/components/dashboard/LoadingState";
import { fetchMarkets } from "@/hooks/useAaveMarkets";
import { fetchSideDataMeta, SIDE_DATA_META_QUERY_KEY } from "@/hooks/useSideDataMeta";
import { QUERY_STALE_TIMES } from "@/config/queryStaleTimes";
import { clearLegacyCacheEntries } from "@/lib/cache";

// Lazy load route components
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
