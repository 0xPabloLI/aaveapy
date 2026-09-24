/**
 * Type declarations for scripts/lib/chain-utils.mjs — consumed by
 * src/test/chain-utils.test.ts (typed via TS strict mode).
 */

/** True when an address-book module name should be included in chain discovery. */
export declare function shouldIncludeModule(name: string): boolean;

/**
 * Discover mainnet chains from @aave-dao/aave-address-book as
 * chainId -> module name. Same chainId from multiple modules prefers
 * AaveV3/V4 modules, then lexicographic order (deterministic).
 */
export declare function discoverMainnetChainModules(): Promise<Map<number, string>>;

/** Discover mainnet chain ids from @aave-dao/aave-address-book modules. */
export declare function discoverMainnetChainIds(): Promise<Set<number>>;
