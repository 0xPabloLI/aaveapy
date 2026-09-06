import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { preloadDefaultTokenIcon } from "@/lib/preloadUtils";
import { validateApiBaseEnv } from "@/lib/apiBase";
import { initAnalytics } from "@/lib/gtag";

validateApiBaseEnv(import.meta.env);
preloadDefaultTokenIcon();
initAnalytics();


createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
