import { defineConfig, loadEnv } from "vite";
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

/**
 * Selective module preload — replaces Vite's automatic modulePreload (which is
 * disabled via `build.modulePreload: false`) with a curated whitelist of chunks
 * that are needed before content renders.  First-paint-only chunks come first;
 * the wallet/SDK chunks (WalletProviders/AaveProviders + their vendor deps) are
 * dynamically imported on every page load, so preloading them starts the
 * download at t0 while modulepreload's download-only semantics (no execute)
 * keep them off the FCP path.
 */
const MODULEPRELOAD_WHITELIST = [
  "vendor-react",
  "vendor-react-libs",
  "vendor-animation",
  "vendor-radix",
  "vendor-query",
  "vendor-ui-utils",
  "vendor-icons",
  "vendor-theme",
  "vendor-ui-libs",
  "vendor-forms",
  "index.esm",
  "rolldown-runtime",
  // Content-stage chunks: dynamically imported, but every page load needs them
  "WalletProviders",
  "vendor-blockchain",
  "AaveProviders",
  "vendor-aave",
] as const;

/** Chunk prefixes that must never be statically reachable from the entry chunk. */
const NO_FIRST_PAINT_CHUNK_PATTERNS = [
  /^assets\/vendor-blockchain-/,
  /^assets\/vendor-aave-/,
  /^assets\/secp256k1-/,
] as const;

/**
 * Result-level guard for the FCP invariant: fail the build when the entry
 * chunk's synchronous import closure can reach a heavy chunk (vendor-blockchain
 * / vendor-aave / secp256k1).  Source-level guards (architecture-guard tests)
 * verify import *shapes*; this verifies the actual bundler output, which also
 * catches bundler-level surprises like a shared module being concatenated into
 * a heavy chunk (e.g. clsx landing inside vendor-blockchain).
 */
function assertFirstPaintChunksPlugin() {
  interface BundleChunk {
    type: string;
    fileName: string;
    isEntry?: boolean;
    imports?: string[];
  }
  return {
    name: "assert-first-paint-chunks",
    apply: "build" as const,
    generateBundle(_options: unknown, bundle: Record<string, BundleChunk>) {
      const chunks = Object.values(bundle).filter((chunk) => chunk.type === "chunk");
      const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const entries = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
      if (entries.length === 0) return;

      // Fail loud instead of walking an empty graph: if the bundler stops
      // reporting static imports, this guard would silently always-pass.
      for (const chunk of chunks) {
        if (!Array.isArray(chunk.imports)) {
          throw new Error(
            `[assert-first-paint-chunks] Chunk "${chunk.fileName}" reports no static import list — ` +
            `cannot verify the entry closure. Fix the guard before trusting a green build.`,
          );
        }
      }

      const visited = new Set<string>();
      const parent = new Map<string, string>();
      const queue = [...entries];
      while (queue.length > 0) {
        const fileName = queue.pop()!;
        if (visited.has(fileName)) continue;
        visited.add(fileName);
        for (const pattern of NO_FIRST_PAINT_CHUNK_PATTERNS) {
          if (pattern.test(fileName)) {
            const chain: string[] = [];
            for (let cur: string | undefined = fileName; cur; cur = parent.get(cur)) chain.unshift(cur);
            throw new Error(
              `[assert-first-paint-chunks] Entry chunk statically reaches "${fileName}".\n` +
              `Import chain: ${chain.join(" -> ")}\n` +
              `This puts a heavy chunk (~400 KB gzip) back on the FCP path. Check for new ` +
              `static imports of wagmi/rainbowkit/@aave modules (or shared modules like cn/clsx ` +
              `concatenated into a heavy chunk) reachable from App.tsx without a lazy() boundary.`,
            );
          }
        }
        const chunk = byFileName.get(fileName);
        for (const imp of chunk?.imports ?? []) {
          if (!parent.has(imp)) parent.set(imp, fileName);
          queue.push(imp);
        }
      }
    },
  };
}

function selectiveModulePreloadPlugin() {
  let chunkPaths: string[] = [];
  return {
    name: "selective-module-preload",
    apply: "build" as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; fileName: string }>) {
      chunkPaths = Object.values(bundle)
        .filter((chunk) => chunk.type === "chunk")
        .map((chunk) => chunk.fileName)
        .filter((fileName) =>
          MODULEPRELOAD_WHITELIST.some((prefix) => fileName.startsWith(`assets/${prefix}-`)),
        );
    },
    transformIndexHtml(html: string) {
      if (chunkPaths.length === 0) return html;
      const tags = chunkPaths
        .map((p) => `    <link rel="modulepreload" crossorigin href="/${p}">`)
        .join("\n");
      return html.replace("</head>", `${tags}\n  </head>`);
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
    deployShaMetaPlugin(),
    selectiveModulePreloadPlugin(),
    assertFirstPaintChunksPlugin(),
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
        // Native rolldown advancedChunks instead of manualChunks: the
        // manualChunks emulation was observed gluing shared modules
        // (@tanstack/query-core, clsx, react-dom bits, …) into whatever chunk
        // had related code (vendor-blockchain), which put heavy code back on
        // the entry chunk's static graph. Explicit regex groups partition
        // node_modules deterministically; app code and unmatched packages go
        // through rolldown's default splitting.
        advancedChunks: {
          groups: [
            // Core React and its direct dependencies - MUST be together
            { name: "vendor-react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            // React ecosystem
            { name: "vendor-react-libs", test: /node_modules[\\/](react-router|react-hook-form|react-day-picker)[\\/]/ },
            // Animation libraries
            { name: "vendor-animation", test: /node_modules[\\/](framer-motion|embla-carousel)[\\/]/ },
            // Radix UI components
            { name: "vendor-radix", test: /node_modules[\\/]@radix-ui[\\/]/ },
            // Query & data fetching
            { name: "vendor-query", test: /node_modules[\\/]@tanstack[\\/]/ },
            // Charts and visualization
            { name: "vendor-charts", test: /node_modules[\\/]recharts[\\/]/ },
            // Icons
            { name: "vendor-icons", test: /node_modules[\\/]lucide-react[\\/]/ },
            // Forms and validation
            { name: "vendor-forms", test: /node_modules[\\/](zod|@hookform)[\\/]/ },
            // UI utilities
            { name: "vendor-ui-utils", test: /node_modules[\\/](class-variance-authority|clsx|tailwind-merge)[\\/]/ },
            // Date utilities
            { name: "vendor-date", test: /node_modules[\\/]date-fns[\\/]/ },
            // Aave protocol
            { name: "vendor-aave", test: /node_modules[\\/]@aave-dao[\\/]/ },
            // Blockchain stack (viem/wagmi/ox/rainbowkit + their transitive
            // deps) — lazy, only reachable via the WalletProviders boundary
            {
              name: "vendor-blockchain",
              test: /node_modules[\\/](viem|wagmi|@wagmi|@rainbow-me|ox|abitype|mipd|zustand|@noble|@adraffy|ua-parser-js|qr|cuer|@vanilla-extract)[\\/]/,
            },
            // UI libraries
            { name: "vendor-ui-libs", test: /node_modules[\\/](sonner|vaul|cmdk)[\\/]/ },
            // Theme
            { name: "vendor-theme", test: /node_modules[\\/]next-themes[\\/]/ },
          ],
        },
      },
    },
    // Increase chunk size warning limit to 600 KB to reduce noise
    chunkSizeWarningLimit: 600,
    // Disable Vite's automatic modulePreload — replaced by the
    // selectiveModulePreloadPlugin which only injects first-paint chunks.
    modulePreload: false,
  },
}));
