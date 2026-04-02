/**
 * Remove Vite's dependency pre-bundle cache so the next dev/build run cannot
 * reuse stale chunks after lockfile or React-resolution changes (common after
 * Lovable / merge syncs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const viteCache = path.join(root, "node_modules", ".vite");

if (fs.existsSync(viteCache)) {
  fs.rmSync(viteCache, { recursive: true, force: true });
  console.log("[clear-vite-cache] removed node_modules/.vite");
} else {
  console.log("[clear-vite-cache] skip (no node_modules/.vite)");
}
