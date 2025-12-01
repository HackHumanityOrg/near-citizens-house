// Configuration
export * from "./config"

// Types
export * from "./types"

// Verification Contract
export * from "./verification-contract"

// Governance Contract
export * from "./governance-contract"

// NEAR integration
export { NearWalletProvider, useNearWallet } from "./near-wallet-provider"

// Verification utilities
export * from "./verification"
export * from "./self-verifier"
export * from "./zk-verify"

// Discourse integration
export { DiscourseProvider, useDiscourse } from "./discourse-provider"
export * from "./discourse-crypto"
