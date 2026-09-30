/**
 * Type declarations for scripts/lib/e2e-port.mjs — the resolver runs as plain
 * node JS, while the Playwright configs that import it are TypeScript and sit
 * outside the typecheck projects.
 */

export const DEFAULT_E2E_PORT: number;

/** The single URL string shared by baseURL, storageState origin and probe URL. */
export function e2eBaseUrl(port: number): string;

/** The local Vite webServer command, `--strictPort` included. */
export function e2eDevServerCommand(port: number): string;

/** Resolve (and for local runs allocate + publish) the e2e webServer port. */
export function resolveE2ePort(env?: Record<string, string | undefined>): Promise<number>;
