// Global vitest setup. Loaded by every test (per vite.config.ts → test.setupFiles).
// Side-effect import registers @testing-library/jest-dom matchers (e.g.
// toBeInTheDocument, toHaveTextContent) on vitest's `expect`. The matchers
// only activate when given DOM elements, so this is a no-op for the
// pre-existing node-env renderToString tests.
import '@testing-library/jest-dom/vitest';
