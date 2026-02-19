/**
 * Application Configuration
 *
 * Derived configuration values from validated environment variables.
 * All env vars are accessed via the T3 Env schema in ./schemas/env.ts
 */
import { env } from "./schemas/env"
import type { NearAccountId } from "./schemas/near"
import { getFastNearRpcUrl } from "./rpc-endpoints"

// NEAR Network Configuration
const networkId = env.NEXT_PUBLIC_NEAR_NETWORK

// FastNEAR RPC URL
const getFastNearUrl = () => getFastNearRpcUrl(networkId)

export const NEAR_CONFIG = {
  networkId,
  // FastNEAR RPC URL
  rpcUrl: getFastNearUrl(),
  // Contract addresses
  verificationContractId: env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,
  governanceContractId: env.NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT,
  // Explorer URLs
  get explorerUrl() {
    return this.networkId === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io"
  },
  get explorerAccountUrl() {
    return (accountId: NearAccountId) => `${this.explorerUrl}/address/${accountId}`
  },
}

// App URL (single app after merge of verification and governance)
export const APP_URL = env.NEXT_PUBLIC_APP_URL ?? "https://citizenshouse.org"

// SumSub Configuration
export const SUMSUB_CONFIG = {
  levelName: env.NEXT_PUBLIC_SUMSUB_LEVEL_NAME,
}

// UserJot Configuration (Feedback Widget)
export const USERJOT_CONFIG = {
  projectId: env.NEXT_PUBLIC_USERJOT_PROJECT_ID ?? "",
  get enabled() {
    return !!this.projectId
  },
}

// Application Constants
export function getSigningRecipient(): string {
  const contractId = NEAR_CONFIG.verificationContractId
  if (!contractId) {
    throw new Error("Verification contract ID not configured")
  }
  return contractId
}

export function getSigningMessage(): string {
  const contractId = NEAR_CONFIG.verificationContractId || "unknown-contract"
  return `Identify myself for ${contractId} at ${APP_URL}`
}

export const CONSTANTS = {
  SIGNING_MESSAGE: getSigningMessage(),
}
