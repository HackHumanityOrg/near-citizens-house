// Configuration
export * from "./config"

// Schemas (central hub for all Zod schemas)
export * from "./schemas"

// RPC Provider
export * from "./providers/rpc-provider"

// Contracts (database interface only; schemas in ./schemas/)
export * from "./contracts/verification/verification-contract"

// Providers
export { NearWalletProvider, useNearWallet } from "./providers/near-wallet-provider"
export { UserJotWidget, identifyUserJotUser } from "./providers/userjot-provider"
export * from "./providers/self-provider"

// Verification utilities
export * from "./verification"
export * from "./zk-verify"

// Self.xyz deep link utilities
export { getUniversalLink } from "@selfxyz/core"
