/**
 * SputnikDAO Bridge Contract TypeScript Client (Read-Only)
 *
 * This client provides typed methods to read from the sputnik-bridge contract.
 * All write operations (addMember, createProposal, etc.) are performed client-side
 * through the wallet connection, not server-side.
 */
import { JsonRpcProvider } from "@near-js/providers"
import { NEAR_CONFIG } from "../../config"
import { bridgeInfoSchema, type BridgeInfo, type IBridgeContractReader } from "./types"

export type { IBridgeContractReader, BridgeInfo }

// ============================================================================
// Implementation
// ============================================================================

/**
 * Read-only client for the bridge contract.
 * Does not require any credentials - only needs the contract ID and RPC URL.
 */
export class BridgeContractReader implements IBridgeContractReader {
  private provider: JsonRpcProvider
  private contractId: string

  constructor(contractId: string, rpcUrl: string) {
    this.contractId = contractId
    this.provider = new JsonRpcProvider({
      url: rpcUrl,
      headers: NEAR_CONFIG.rpcHeaders,
    })

    console.log(`[BridgeContract] Initialized read-only client`)
    console.log(`[BridgeContract] Contract ID: ${this.contractId}`)
    console.log(`[BridgeContract] RPC URL: ${rpcUrl}`)
  }

  // ==================== View Methods ====================

  async getInfo(): Promise<BridgeInfo> {
    const result = await this.provider.callFunction<Record<string, string>>(this.contractId, "get_info", {})

    if (!result) {
      throw new Error("Failed to get bridge info")
    }

    // Validate and transform using Zod schema (strictObject catches unexpected fields)
    return bridgeInfoSchema.parse(result)
  }

  async getBackendWallet(): Promise<string> {
    const result = await this.provider.callFunction<string>(this.contractId, "get_backend_wallet", {})
    return result ?? ""
  }

  async getSputnikDao(): Promise<string> {
    const result = await this.provider.callFunction<string>(this.contractId, "get_sputnik_dao", {})
    return result ?? ""
  }

  async getVerifiedAccountsContract(): Promise<string> {
    const result = await this.provider.callFunction<string>(this.contractId, "get_verified_accounts_contract", {})
    return result ?? ""
  }

  async getCitizenRole(): Promise<string> {
    const result = await this.provider.callFunction<string>(this.contractId, "get_citizen_role", {})
    return result ?? ""
  }
}

// ============================================================================
// Singleton Instance (Lazy Initialization)
// ============================================================================

let bridgeInstance: IBridgeContractReader | null = null

function createBridgeContractReader(): IBridgeContractReader {
  const { bridgeContractId, rpcUrl } = NEAR_CONFIG

  if (!bridgeContractId) {
    throw new Error("Missing NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT configuration. Please set the bridge contract address.")
  }

  console.log("[BridgeContract] Creating read-only bridge contract client")
  console.log(`[BridgeContract] Contract: ${bridgeContractId}`)

  return new BridgeContractReader(bridgeContractId, rpcUrl)
}

// Lazy singleton - only initialize when first accessed
export const bridgeContract: IBridgeContractReader = new Proxy({} as IBridgeContractReader, {
  get(target, prop) {
    if (!bridgeInstance) {
      bridgeInstance = createBridgeContractReader()
    }
    return bridgeInstance[prop as keyof IBridgeContractReader]
  },
})
