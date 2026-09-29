/**
 * Resolve the port for the local e2e webServer.
 *
 * Why this exists: a fixed port plus Playwright's `reuseExistingServer` makes
 * two concurrent local runs share one server, and the first one to finish
 * takes it down under the other's feet. See
 * docs/specs/e2e-parallel-port-isolation.md for the incident and the
 * behavioural contract (test rows map to that matrix).
 */
import net from 'node:net';

/** Port the CI webServer (`preview:staging`) is pinned to. */
export const DEFAULT_E2E_PORT = 4173;

/**
 * Build the one URL string shared by baseURL, storageState origin and the
 * webServer probe URL. Callers must reuse the result rather than rebuild it,
 * or a consent grant ends up filed under a port nothing serves.
 *
 * @param {number} port
 * @returns {string}
 */
export function e2eBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

/**
 * The local Vite command, kept here so every Playwright config starts the same
 * server contract. `--strictPort` stops Vite from drifting to the next free
 * port if our allocation is taken in the probe-to-bind window; without it the
 * run dies on a url timeout that never names the port.
 *
 * @param {number} port
 * @returns {string}
 */
export function e2eDevServerCommand(port) {
  return `npm run dev:staging -- --host 127.0.0.1 --port ${port} --strictPort`;
}

function parsePort(raw) {
  if (!/^\d+$/.test(raw)) return null;
  const port = Number(raw);
  return port >= 1 && port <= 65535 ? port : null;
}

async function allocatePort() {
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve(probe.address().port));
  });
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * Returns the port to use, and — for a local run — publishes it on
 * `env.E2E_PORT` so Playwright workers, which inherit the runner's
 * environment, resolve the same value instead of each allocating their own.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<number>}
 */
export async function resolveE2ePort(env = process.env) {
  const explicit = env.E2E_PORT;

  if (explicit !== undefined && explicit !== '') {
    const port = parsePort(explicit);
    if (port === null) {
      throw new Error(`E2E_PORT must be an integer between 1 and 65535, got "${explicit}".`);
    }
    if (env.CI && port !== DEFAULT_E2E_PORT) {
      throw new Error(`E2E_PORT=${explicit} contradicts CI: the CI webServer pins ${DEFAULT_E2E_PORT}.`);
    }
    return port;
  }

  if (env.CI) return DEFAULT_E2E_PORT;

  const port = await allocatePort();
  env.E2E_PORT = String(port);
  return port;
}
