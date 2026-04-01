import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadDefaultTokenIcon } from "@/lib/preloadUtils";

preloadDefaultTokenIcon();

createRoot(document.getElementById("root")!).render(<App />);
