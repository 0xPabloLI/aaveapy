#!/usr/bin/env node
/**
 * Checks chainIconMap.ts against upstream aave/interface networksConfig.ts
 * and @aave-dao/aave-address-book to detect missing chain icon entries.
 *
 * The chainIconMap is indexed by chainId (number). Two data sources:
 *  1. upstream networksConfig.ts (aave/interface) — slug = networkLogoPath basename
 *  2. address-book registry (discoverMainnetChainModules) — registry-only chains
 *     get a placeholder entry with a derived slug (see scripts/lib/chain-slug.mjs)
 *     and a neutral placeholder SVG when no icon file exists yet.
 *
 * Usage: node scripts/sync-chain-icon-map-upstream.mjs [--write]
 *   Default: dry-run, report gaps only (exit 1 if gaps found).
 *   --write:  append placeholder entries + generate missing SVGs.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';
import { discoverMainnetChainModules } from './lib/chain-utils.mjs';
import { deriveChainSlug, loadSlugOverrides, renderPlaceholderSvg, monogramFromSlug } from './lib/chain-slug.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const UPSTREAM_PUBLIC_ROOT = 'https://raw.githubusercontent.com/aave/interface/main/public';
const LOCAL_CHAIN_ICONS_PATH = path.join(ROOT, 'src/lib/chainIconMap.ts');
const NETWORKS_ICONS_DIR = path.join(ROOT, 'public', 'icons', 'networks');
const SLUG_OVERRIDES_PATH = path.join(ROOT, 'scripts', 'data', 'chain-slug-overrides.json');

function parseExpectedProdNetworks(networksConfigContent) {
  const prodStart = networksConfigContent.indexOf('export const prodNetworkConfig');
  if (prodStart < 0) {
    throw new Error('Failed to locate prodNetworkConfig in networksConfig.ts');
  }
  const content = networksConfigContent.slice(prodStart);
  const lines = content.split('\n');

  const expected = [];
  let outerDepth = 0;
  let outerStarted = false;
  let inBlock = false;
  let depth = 0;
  let current = null;

  for (const line of lines) {
    const opens = countChar(line, '{');
    const closes = countChar(line, '}');
    if (!outerStarted && opens > 0) {
      outerStarted = true;
    }
    if (outerStarted) {
      outerDepth += opens;
      outerDepth -= closes;
      if (outerDepth <= 0) {
        if (inBlock) {
          depth += opens;
          depth -= closes;
          if (depth <= 0 && current?.name && current?.networkLogoPath && current?.wagmiChain) {
            expected.push(current);
          }
        }
        break;
      }
    }

    if (!inBlock) {
      const start = line.match(/^\s*\[(ChainId\.[a-zA-Z0-9_]+|[a-zA-Z0-9_]+\.id)\]:\s*\{/);
      if (!start) continue;
      inBlock = true;
      depth = 1;
      current = {
        key: start[1],
        name: null,
        networkLogoPath: null,
        wagmiChain: null,
      };
      continue;
    }

    if (depth === 1) {
      const nameMatch = line.match(/^\s*name:\s*'([^']+)'/);
      if (nameMatch) current.name = nameMatch[1];

      const logoMatch = line.match(/^\s*networkLogoPath:\s*'([^']+)'/);
      if (logoMatch) current.networkLogoPath = logoMatch[1];

      const wagmiMatch = line.match(/wagmiChain:\s*([a-zA-Z0-9_]+)/);
      if (wagmiMatch) current.wagmiChain = wagmiMatch[1];
    }

    depth += opens;
    depth -= closes;
    if (depth <= 0) {
      inBlock = false;
      depth = 0;
      if (current?.name && current?.networkLogoPath && current?.wagmiChain) {
        expected.push(current);
      }
      current = null;
    }
  }

  return expected;
}

function iconBaseFromPath(iconPath) {
  return path.basename(iconPath).replace(/\.[^.]+$/, '');
}

export function parseChainIconMapEntries(fileContent) {
  const match = fileContent.match(/export const chainIconMap:\s*Record<number,\s*string>\s*=\s*\{([\s\S]*?)\};/);
  if (!match || match.index == null) {
    throw new Error('Failed to parse chainIconMap in src/lib/chainIconMap.ts');
  }

  const entries = new Map();
  const entryMatches = match[1].matchAll(/(\d+)\s*:\s*'([^']+)'/g);
  for (const m of entryMatches) {
    entries.set(Number(m[1]), m[2]);
  }

  return entries;
}

async function resolveChainIds(wagmiChainNames) {
  const chainIds = new Map();
  try {
    const chains = await import('wagmi/chains');
    for (const name of wagmiChainNames) {
      const chain = chains[name];
      if (chain?.id) {
        chainIds.set(name, chain.id);
      }
    }
  } catch {
    console.warn('Could not import wagmi/chains for chain ID resolution');
  }
  return chainIds;
}

async function buildViemChainNames() {
  try {
    const chains = await import('viem/chains');
    const map = new Map();
    for (const chain of Object.values(chains)) {
      if (chain && typeof chain.id === 'number' && typeof chain.name === 'string') {
        map.set(chain.id, chain.name);
      }
    }
    return map;
  } catch {
    console.warn('Could not import viem/chains; slug Level 3 skipped');
    return new Map();
  }
}

/**
 * Registry-only chains: in the address-book registry, missing from the map,
 * and not covered by the upstream networksConfig source (those are owned by
 * the upstream iconBase logic). Sorted by chainId for deterministic output.
 * @param {Map<number, string>} registryModules chainId -> module name
 * @param {Map<number, string>} mapEntries local chainIconMap entries
 * @param {Set<number>} upstreamChainIds chainIds the upstream source already covers
 * @returns {{ chainId: number, moduleName?: string }[]}
 */
export function computeRegistryGaps(registryModules, mapEntries, upstreamChainIds) {
  const gaps = [];
  for (const [chainId, moduleName] of [...registryModules].sort((a, b) => a[0] - b[0])) {
    if (mapEntries.has(chainId)) continue;
    if (upstreamChainIds.has(chainId)) continue;
    gaps.push({ chainId, moduleName });
  }
  return gaps;
}

/**
 * Derive slugs for registry gaps and plan placeholder SVGs for slugs that
 * have no icon file on disk yet. Pure aside from the injected existsFn.
 * @param {{ chainId: number, moduleName?: string }[]} gaps
 * @param {object} resolvers
 * @param {Map<number, string>} [resolvers.overrides]
 * @param {Map<number, string>} [resolvers.viemChains]
 * @param {typeof fetch} [resolvers.fetchImpl]
 * @param {(fileName: string) => boolean} resolvers.existsFn
 * @returns {Promise<{ entries: { chainId: number, slug: string, source: string }[], svgPlans: { fileName: string, content: string, chainId: number }[] }>}
 */
export async function planRegistryAdditions(gaps, resolvers) {
  const { overrides, viemChains, fetchImpl, existsFn } = resolvers;
  const entries = [];
  const svgPlans = [];
  const plannedSlugs = new Set();
  for (const gap of gaps) {
    const { slug, source } = await deriveChainSlug({
      chainId: gap.chainId,
      moduleName: gap.moduleName,
      overrides,
      viemChains,
      fetchImpl,
    });
    entries.push({ chainId: gap.chainId, slug, source });
    if (!existsFn(`${slug}.svg`) && !plannedSlugs.has(slug)) {
      plannedSlugs.add(slug);
      svgPlans.push({
        fileName: `${slug}.svg`,
        content: renderPlaceholderSvg(monogramFromSlug(slug)),
        chainId: gap.chainId,
      });
    }
  }
  return { entries, svgPlans };
}

/**
 * Write all planned SVGs. Throws on first failure — callers must treat that
 * as "nothing written" (map write happens only after this succeeds) so the
 * repo never ends up with a map entry whose SVG is missing.
 */
export async function applySvgPlans(svgPlans, { NETWORKS_ICONS_DIR: iconsDir, writeFileFn }) {
  for (const plan of svgPlans) {
    const dest = path.join(iconsDir, plan.fileName);
    await writeFileFn(dest, plan.content);
    console.log(`  wrote ${path.relative(ROOT, dest)}`);
  }
}

/**
 * Append entry lines before the closing brace of chainIconMap.
 * @param {string} content current file content
 * @param {string[]} entryLines formatted `  <id>: '<slug>',` lines
 */
export function insertEntries(content, entryLines) {
  if (entryLines.length === 0) return content;
  const insertPoint = content.lastIndexOf('};');
  return `${content.slice(0, insertPoint)}${entryLines.join('\n')}\n${content.slice(insertPoint)}`;
}

/**
 * Rename self-healing: when the upstream networksConfig has assigned an
 * iconBase to a chainId whose map entry was auto-derived earlier (e.g. the
 * placeholder 'arc' vs upstream 'chainlink-arc'), converge the entry to the
 * upstream value. Without this, the mapping check (which compares by value)
 * would fail even though the chainId is present.
 * @param {{ name: string|null, networkLogoPath: string|null, wagmiChain: string }[]} upstreamNetworks
 * @param {Map<string, number>} chainIdMap wagmiChain -> chainId
 * @param {Map<number, string>} mapEntries local chainIconMap entries
 * @returns {{ chainId: number, from: string, to: string, iconPath: string }[]}
 */
export function computeUpstreamRenames(upstreamNetworks, chainIdMap, mapEntries) {
  const renames = [];
  for (const network of upstreamNetworks) {
    const chainId = chainIdMap.get(network.wagmiChain);
    if (!chainId) continue;
    const current = mapEntries.get(chainId);
    if (current == null) continue;
    const iconBase = iconBaseFromPath(network.networkLogoPath);
    if (current === iconBase) continue;
    renames.push({ chainId, from: current, to: iconBase, iconPath: network.networkLogoPath });
  }
  return renames;
}

/**
 * Rewrite renamed entries in the map file content.
 * @param {string} content
 * @param {{ chainId: number, from: string, to: string }[]} renames
 */
export function applyRenames(content, renames) {
  let next = content;
  for (const { chainId, from, to } of renames) {
    // `from` comes from upstream iconBase filenames, which may contain regex
    // metacharacters (e.g. '.') — escape before building the pattern.
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\s+${chainId}: )'${escapedFrom}'(,)`);

    const replaced = next.replace(pattern, `$1'${to}'$2`);
    if (replaced === next) {
      throw new Error(`Failed to apply rename for chainId ${chainId} ('${from}' -> '${to}'): entry line not found`);
    }
    next = replaced;
  }
  return next;
}

/**
 * Make sure the renamed slug has an icon file: keep existing files untouched,
 * download the upstream asset when available, otherwise fall back to a
 * neutral placeholder.
 */
export async function resolveRenameSvg(rename, io) {
  const { UPSTREAM_PUBLIC_ROOT: publicRoot, existsFn, fetchImpl, writeFileFn } = io;
  const fileName = `${rename.to}.svg`;
  if (existsFn(fileName)) return;

  // Two attempts before degrading to a placeholder — a transient upstream
  // hiccup must not permanently replace a real logo with a placeholder
  // (once written, the "existing file is never overwritten" rule keeps it).
  let lastErrMsg = 'unknown error';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchImpl(`${publicRoot}${rename.iconPath}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFileFn(path.join(NETWORKS_ICONS_DIR, fileName), buf);
      console.log(`  downloaded ${fileName} from upstream`);
      return;
    } catch (err) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }
  console.warn(`  upstream download failed after 2 attempts (${lastErrMsg}); writing placeholder for ${fileName}`);
  const content = renderPlaceholderSvg(monogramFromSlug(rename.to));
  await writeFileFn(path.join(NETWORKS_ICONS_DIR, fileName), content);
}

async function main() {
  const shouldWrite = process.argv.includes('--write');

  const [upstreamContent, localContent, overridesRaw] = await Promise.all([
    fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL),
    readFile(LOCAL_CHAIN_ICONS_PATH, 'utf8'),
    readFile(SLUG_OVERRIDES_PATH, 'utf8'),
  ]);

  const upstreamNetworks = parseExpectedProdNetworks(upstreamContent);
  if (upstreamNetworks.length === 0) {
    throw new Error('Upstream parsing yielded 0 network entries.');
  }

  const localEntries = parseChainIconMapEntries(localContent);

  const wagmiChainNames = [...new Set(upstreamNetworks.map((n) => n.wagmiChain))];
  const chainIdMap = await resolveChainIds(wagmiChainNames);

  // Source 1: upstream networksConfig gaps (existing behaviour)
  const gaps = [];
  const upstreamChainIds = new Set();
  for (const network of upstreamNetworks) {
    const chainId = chainIdMap.get(network.wagmiChain);
    if (!chainId) {
      console.warn(`  Could not resolve chainId for wagmiChain=${network.wagmiChain} (name=${network.name})`);
      continue;
    }
    upstreamChainIds.add(chainId);
    if (!localEntries.has(chainId)) {
      const iconBase = iconBaseFromPath(network.networkLogoPath);
      gaps.push({ chainId, name: network.name, iconBase, wagmiChain: network.wagmiChain });
    }
  }

  // Source 2: address-book registry-only chains (AAV-1297)
  const registryModules = await discoverMainnetChainModules();
  const registryGaps = computeRegistryGaps(registryModules, localEntries, upstreamChainIds);

  // Rename self-healing: converge auto-derived entries to upstream iconBase
  const renames = computeUpstreamRenames(upstreamNetworks, chainIdMap, localEntries);

  let registryPlan = { entries: [], svgPlans: [] };
  if (registryGaps.length > 0) {
    const overrides = loadSlugOverrides(overridesRaw);
    const viemChains = await buildViemChainNames();
    registryPlan = await planRegistryAdditions(registryGaps, {
      overrides,
      viemChains,
      fetchImpl: fetch,
      existsFn: (fileName) => fs.existsSync(path.join(NETWORKS_ICONS_DIR, fileName)),
    });
  }

  if (gaps.length === 0 && registryGaps.length === 0 && renames.length === 0) {
    console.log(
      `chainIconMap covers all ${upstreamNetworks.length} upstream networks and all ${registryModules.size} registry chains.`,
    );
    return;
  }

  if (gaps.length > 0) {
    console.log(`Found ${gaps.length} missing upstream chain icon mapping(s):`);
    for (const g of gaps) {
      console.log(`  chainId=${g.chainId} (${g.name}) → iconBase='${g.iconBase}'`);
    }
  }
  if (registryGaps.length > 0) {
    console.log(`Found ${registryGaps.length} registry-only chain(s) missing from chainIconMap:`);
    for (const entry of registryPlan.entries) {
      console.log(`  chainId=${entry.chainId} → slug='${entry.slug}' (source=${entry.source})`);
    }
  }
  if (renames.length > 0) {
    console.log(`Found ${renames.length} chainIconMap entry(ies) to rename to upstream iconBase:`);
    for (const r of renames) {
      console.log(`  chainId=${r.chainId}: '${r.from}' → '${r.to}'`);
    }
  }

  if (shouldWrite) {
    // Atomicity: write all SVGs first; if any write throws, the map below is
    // never touched, so the repo never holds a map entry without its SVG.
    for (const rename of renames) {
      await resolveRenameSvg(rename, {
        UPSTREAM_PUBLIC_ROOT,
        existsFn: (fileName) => fs.existsSync(path.join(NETWORKS_ICONS_DIR, fileName)),
        fetchImpl: fetch,
        writeFileFn: async (dest, content) => {
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, content);
        },
      });
    }
    await applySvgPlans(registryPlan.svgPlans, {
      NETWORKS_ICONS_DIR,
      writeFileFn: async (dest, content) => {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, content, 'utf8');
      },
    });

    const entryLines = [
      ...gaps.map((g) => `  ${g.chainId}: '${g.iconBase}',`),
      ...registryPlan.entries.map((e) => `  ${e.chainId}: '${e.slug}',`),
    ];
    let nextContent = insertEntries(localContent, entryLines);
    nextContent = applyRenames(nextContent, renames);
    await writeFile(LOCAL_CHAIN_ICONS_PATH, nextContent, 'utf8');
    console.log(`Updated chainIconMap: ${entryLines.length} added, ${renames.length} renamed.`);
  } else {
    console.log('Run with --write to append missing entries.');
    process.exit(1);
  }
}

// Only run main() when invoked directly — test files import this module for
// its pure helpers, and a top-level fetch side effect would make `node --test`
// fail whenever the network is unreachable.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
