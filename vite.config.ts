import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(__dirname, "node_modules/react");
const reactDomRoot = path.resolve(__dirname, "node_modules/react-dom");

/** Embed git SHA in index.html for deploy smoke tests (Vercel / GitHub Actions). */
function deployShaMetaPlugin() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    "";
  return {
    name: "deploy-sha-meta",
    transformIndexHtml(html: string) {
      if (!sha) return html;
      return html.replace(
        "</head>",
        `    <meta name="aaveapy-deploy-sha" content="${sha}" />\n  </head>`,
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: true,
    port: Number(process.env.PORT) || 8080,
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
  },
  plugins: [
    react(),
    deployShaMetaPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  resolve: {
    // Fixes "Cannot read properties of null (reading 'useMemo')" crashes
    // caused by duplicated React instances in Vite optimized deps.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: reactRoot,
      "react-dom": reactDomRoot,
      "react/jsx-runtime": path.join(reactRoot, "jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(reactRoot, "jsx-dev-runtime.js"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**", "**/e2e/**"],
    // Default environment stays `node` for fast/pure tests. Component tests
    // that need a DOM opt-in via the file-level pragma
    // `// @vitest-environment happy-dom`.
    setupFiles: ["./src/test/setup.ts"],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for large dependencies
          if (id.includes('node_modules')) {
            // Core React and its direct dependencies - MUST be together
            if (
              id.includes('/react/') || 
              id.includes('/react-dom/') || 
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            // React ecosystem
            if (id.includes('react-router') || id.includes('react-hook-form') || id.includes('react-day-picker')) {
              return 'vendor-react-libs';
            }
            // Animation libraries
            if (id.includes('framer-motion') || id.includes('embla-carousel')) {
              return 'vendor-animation';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // Query & data fetching
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Charts and visualization
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Forms and validation
            if (id.includes('zod') || id.includes('@hookform')) {
              return 'vendor-forms';
            }
            // UI utilities
            if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'vendor-ui-utils';
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Aave protocol
            if (id.includes('@bgd-labs')) {
              return 'vendor-aave';
            }
            // UI libraries
            if (id.includes('sonner') || id.includes('vaul') || id.includes('cmdk')) {
              return 'vendor-ui-libs';
            }
            // Theme
            if (id.includes('next-themes')) {
              return 'vendor-theme';
            }
          }
        },
      },
    },
    // Increase chunk size warning limit to 600 KB to reduce noise
    chunkSizeWarningLimit: 600,
  },
}));
