/**
 * Fail CI/local check if more than one resolved semver of react or react-dom
 * appears in the npm tree (typical cause of Invalid hook call / null useMemo).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const versions = {
  react: new Set(),
  "react-dom": new Set(),
};

/** npm ls --json lists dependencies by package name; leaves like react often omit `name`, only `version`. */
function walkDependencyEntries(deps) {
  if (!deps || typeof deps !== "object") return;
  for (const [pkgName, meta] of Object.entries(deps)) {
    if (!meta || typeof meta !== "object") continue;
    const v = meta.version;
    if (pkgName === "react" && typeof v === "string") {
      versions.react.add(v);
    }
    if (pkgName === "react-dom" && typeof v === "string") {
      versions["react-dom"].add(v);
    }
    walkDependencyEntries(meta.dependencies);
  }
}

let tree;
try {
  const out = execSync("npm ls react react-dom --json", {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  tree = JSON.parse(out);
} catch (err) {
  const stdout = err.stdout?.toString?.() ?? "";
  try {
    tree = JSON.parse(stdout || "{}");
  } catch {
    console.error("[check-react-singleton] npm ls failed; run npm ci first.");
    process.exit(1);
  }
}

walkDependencyEntries(tree.dependencies);

const problems = [];
if (versions.react.size > 1) {
  problems.push(`react: ${[...versions.react].join(", ")}`);
}
if (versions["react-dom"].size > 1) {
  problems.push(`react-dom: ${[...versions["react-dom"]].join(", ")}`);
}

if (problems.length > 0) {
  console.error("[check-react-singleton] Multiple versions in tree:", problems.join(" | "));
  console.error("Fix: align package.json overrides and lockfile, then npm ci.");
  process.exit(1);
}

if (versions.react.size === 0 && versions["react-dom"].size === 0) {
  console.warn("[check-react-singleton] No react entries found (missing node_modules?)");
  process.exit(1);
}

console.log("[check-react-singleton] ok (single react / react-dom resolution)");
