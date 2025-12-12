// Configuration
export * from "./config"

// RPC Provider
export * from "./rpc"

// Contracts
export * from "./contracts/verification"
export * from "./contracts/sputnik-dao"
export * from "./contracts/bridge"

// NEAR integration
export { NearWalletProvider, useNearWallet } from "./near-wallet-provider"

// Verification utilities
export * from "./verification"
export * from "./self-verifier"
export * from "./zk-verify"

// Self.xyz deep link utilities
export { getUniversalLink } from "@selfxyz/core"
