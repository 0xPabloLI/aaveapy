import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { preloadDefaultTokenIcon } from "@/lib/preloadUtils";
import { validateApiBaseEnv } from "@/lib/apiBase";

validateApiBaseEnv(import.meta.env);
preloadDefaultTokenIcon();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
