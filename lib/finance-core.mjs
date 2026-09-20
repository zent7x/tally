/**
 * Compatibility entry point for older test tooling. Run through tsx so this
 * delegates to the shipped TypeScript engine instead of maintaining a mirror.
 */
export * from "../src/lib/finance/index.ts";
export { parseAmount as parseNum } from "../src/lib/finance/csv.ts";
