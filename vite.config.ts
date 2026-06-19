import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
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

/** Warn (don't fail) if VITE_API_BASE_URL is missing — falls back to staging via src/lib/apiBase.ts. */
function validateEnvPlugin() {
  return {
    name: "validate-env",
    apply: "build" as const,
    config(_config: unknown, { mode }: { mode: string }) {
      const env = loadEnv(mode, process.cwd(), "");
      // Must stay in sync with isMissingApiBase() in src/lib/apiBase.ts
      if (env.VITE_API_BASE_URL == null || env.VITE_API_BASE_URL.trim() === '') {
        console.warn(
          "[validate-env] VITE_API_BASE_URL not set — falling back to staging API (https://staging-api.aaveapy.com/api).",
        );
      }
    },
  };
}

function generateOpenApiPlugin() {
  return {
    name: "generate-openapi",
    buildStart() {
      try {
        execSync("node --experimental-strip-types scripts/generate-openapi.ts", {
          cwd: __dirname,
          stdio: "inherit",
        });
      } catch {
        console.warn("[generate-openapi] Failed to generate openapi.json — skipping");
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: true,
    port: Number(process.env.PORT) || 8080,
    watch: {
      ignored: ["**/.codeartsdoer/**"],
    },
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
  },
  plugins: [
    react(),
    validateEnvPlugin(),
    generateOpenApiPlugin(),
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
      // `@aave/react-v3` ships its own bundled copy of `@aave/graphql` (V3
      // schema) under `node_modules/@aave/react-v3/node_modules/@aave/graphql`.
      // Vite refuses to resolve through `node_modules/*` because the
      // @aave/react package's `exports` field blocks deep paths. We expose
      // the V3 GraphQL document bundle under a project-local alias so the
      // V3 urql client can be refreshed with the matching V3 documents
      // (the V4 documents from the top-level `@aave/graphql` would not
      // match `r.query === document` inside `refreshQueryWhere`).
      // See ADR-0015 §S4.
      "@aave/react-v3/graphql-queries": path.resolve(
        __dirname,
        "node_modules/@aave/react-v3/node_modules/@aave/graphql/dist/index.js",
      ),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**", "**/e2e/**", "scripts/**"],
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
