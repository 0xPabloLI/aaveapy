/**
 * Shared utilities for upstream drift-check scripts.
 */

/**
 * Fetch a URL with an AbortController-based timeout.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
export async function fetchWithTimeout(url, timeoutMs = 15000, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/**
 * Count occurrences of a single character in a string.
 * @param {string} input
 * @param {string} char
 * @returns {number}
 */
export function countChar(input, char) {
  let count = 0;
  for (const ch of input) {
    if (ch === char) count += 1;
  }
  return count;
}
