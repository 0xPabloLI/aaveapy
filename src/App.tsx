import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import LoadingState from "@/components/dashboard/LoadingState";
import { fetchMarkets, fetchMarketsList } from "@/hooks/useAaveMarkets";
import { QUERY_STALE_TIMES } from "@/config/queryStaleTimes";

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

// Prefetch critical data immediately on app load
// This starts fetching before React components mount
queryClient.prefetchQuery({
  queryKey: ['aave-markets'],
  queryFn: fetchMarkets,
  staleTime: QUERY_STALE_TIMES.marketApi,
});
queryClient.prefetchQuery({
  queryKey: ['aave-markets-list'],
  queryFn: fetchMarketsList,
  staleTime: QUERY_STALE_TIMES.marketApi,
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
