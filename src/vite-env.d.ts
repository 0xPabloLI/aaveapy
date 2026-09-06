/// <reference types="vite/client" />

// Vite aliases this specifier to the V3 GraphQL documents bundled inside
// `@aave/react-v3` (see vite.config.ts). TS cannot resolve it through the
// package `exports` map, so declare the module shape here.
declare module '@aave/react-v3/graphql-queries' {
  export const UserSuppliesQuery: unknown
  export const UserBorrowsQuery: unknown
}
