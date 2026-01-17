// Configuration
export * from "./config"

// Schemas (central hub for all Zod schemas)
export * from "./schemas"

// RPC Provider
export * from "./rpc"

// Contracts (database interface only; schemas in ./schemas/)
export * from "./contracts/verification/verification-contract"

// NEAR integration
export { NearWalletProvider, useNearWallet } from "./near-wallet-provider"

// UserJot feedback widget
export { UserJotWidget, identifyUserJotUser } from "./userjot-provider"

// Verification utilities
export * from "./verification"
export * from "./self-verifier"
export * from "./zk-verify"

// Self.xyz deep link utilities
export { getUniversalLink } from "@selfxyz/core"
