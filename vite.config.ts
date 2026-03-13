import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom"],
    force: true,
  },
  resolve: {
    // Fixes "Cannot read properties of null (reading 'useMemo')" crashes
    // caused by duplicated React instances in Vite optimized deps.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
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
