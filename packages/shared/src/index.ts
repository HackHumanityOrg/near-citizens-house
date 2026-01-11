// Configuration
export * from "./config"

// Validation
export * from "./validation"

// RPC Provider
export * from "./rpc"

// Contracts
export * from "./contracts/verification"

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
