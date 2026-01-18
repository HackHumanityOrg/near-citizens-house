// Configuration (client-safe only - server config in ./config.server.ts)
export * from "./config"

// Schemas (central hub for all Zod schemas)
export * from "./schemas"

// Contracts (database interface only; schemas in ./schemas/)
export * from "./contracts/verification/verification-contract"

// Providers
export { NearWalletProvider, useNearWallet } from "./providers/near-wallet-provider"
export { UserJotWidget, identifyUserJotUser } from "./providers/userjot-provider"

// Verification utilities
export * from "./verification"

// Self.xyz deep link utilities
export { getUniversalLink } from "@selfxyz/core"

// NOTE: Server-only modules are NOT exported here to prevent client import errors:
// - ./providers/rpc-provider → import directly: import { createRpcProvider } from "@/lib/providers/rpc-provider"
// - ./providers/self-provider → import directly: import { getVerifier } from "@/lib/providers/self-provider"
// - ./zk-verify → import directly: import { verifyStoredProof } from "@/lib/zk-verify"
// - ./config.server → import directly: import { NEAR_SERVER_CONFIG, CELO_CONFIG } from "@/lib/config.server"
