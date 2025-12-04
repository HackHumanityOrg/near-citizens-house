/**
 * SputnikDAO Bridge Contract TypeScript Client
 *
 * This client provides typed methods to interact with the sputnik-bridge contract
 * which acts as an intermediary between verified accounts and SputnikDAO.
 */
import { Account } from "@near-js/accounts"
import type { Provider } from "@near-js/providers"
import type { Signer } from "@near-js/signers"
import { KeyPair } from "@near-js/crypto"
import { JsonRpcProvider } from "@near-js/providers"
import { KeyPairSigner } from "@near-js/signers"
import { actionCreators } from "@near-js/transactions"
import { NEAR_CONFIG } from "./config"

// ============================================================================
// Types
// ============================================================================

/**
 * Bridge contract configuration
 */
export interface BridgeInfo {
  backendWallet: string
  sputnikDao: string
  verifiedAccountsContract: string
  citizenRole: string
}

/**
 * Contract response format (snake_case)
 */
interface ContractBridgeInfo {
  backend_wallet: string
  sputnik_dao: string
  verified_accounts_contract: string
  citizen_role: string
}

/**
 * Interface for bridge contract operations
 */
export interface IBridgeContract {
  /**
   * Get bridge contract info
   */
  getInfo(): Promise<BridgeInfo>

  /**
   * Get the backend wallet address
   */
  getBackendWallet(): Promise<string>

  /**
   * Get the SputnikDAO contract address
   */
  getSputnikDao(): Promise<string>

  /**
   * Get the verified accounts contract address
   */
  getVerifiedAccountsContract(): Promise<string>

  /**
   * Get the citizen role name
   */
  getCitizenRole(): Promise<string>

  /**
   * Add a verified account as a member to SputnikDAO
   * @param nearAccountId The NEAR account to add as a citizen member
   * @param depositNear Amount of NEAR to attach for proposal bond (default: 0.1)
   * @returns Transaction hash
   */
  addMember(nearAccountId: string, depositNear?: number): Promise<string>

  /**
   * Create a text-only proposal on SputnikDAO
   * @param description Proposal description (markdown)
   * @param depositNear Amount of NEAR to attach for proposal bond (default: 0.1)
   * @returns Proposal ID
   */
  createProposal(description: string, depositNear?: number): Promise<number>

  /**
   * Update the backend wallet address (admin only)
   * @param newBackendWallet New backend wallet address
   */
  updateBackendWallet(newBackendWallet: string): Promise<void>

  /**
   * Update the citizen role name (admin only)
   * @param newRole New role name
   */
  updateCitizenRole(newRole: string): Promise<void>
}

// ============================================================================
// Implementation
// ============================================================================

export class SputnikBridgeContract implements IBridgeContract {
  private account: Account | null = null
  private provider: JsonRpcProvider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(
    private backendAccountId: string,
    private backendPrivateKey: string,
    contractId: string,
    private rpcUrl: string,
  ) {
    this.contractId = contractId
    this.initialized = this.init()
  }

  private async init() {
    try {
      const keyPair = KeyPair.fromString(this.backendPrivateKey as `ed25519:${string}`)
      const signer = new KeyPairSigner(keyPair)

      this.provider = new JsonRpcProvider({
        url: this.rpcUrl,
        headers: NEAR_CONFIG.rpcHeaders,
      })

      this.account = new Account(
        this.backendAccountId,
        this.provider as unknown as Provider,
        signer as unknown as Signer,
      )

      console.log(`[SputnikBridge] Initialized with account: ${this.backendAccountId}`)
      console.log(`[SputnikBridge] Contract ID: ${this.contractId}`)
    } catch (error) {
      console.error("[SputnikBridge] Initialization error:", error)
      throw error
    }
  }

  private async ensureInitialized() {
    await this.initialized
    if (!this.account) {
      throw new Error("NEAR account not initialized")
    }
  }

  // ==================== View Methods ====================

  async getInfo(): Promise<BridgeInfo> {
    await this.ensureInitialized()

    const result = await this.provider!.callFunction<ContractBridgeInfo>(this.contractId, "get_info", {})

    if (!result) {
      throw new Error("Failed to get bridge info")
    }

    return {
      backendWallet: result.backend_wallet,
      sputnikDao: result.sputnik_dao,
      verifiedAccountsContract: result.verified_accounts_contract,
      citizenRole: result.citizen_role,
    }
  }

  async getBackendWallet(): Promise<string> {
    await this.ensureInitialized()
    const result = await this.provider!.callFunction<string>(this.contractId, "get_backend_wallet", {})
    return result ?? ""
  }

  async getSputnikDao(): Promise<string> {
    await this.ensureInitialized()
    const result = await this.provider!.callFunction<string>(this.contractId, "get_sputnik_dao", {})
    return result ?? ""
  }

  async getVerifiedAccountsContract(): Promise<string> {
    await this.ensureInitialized()
    const result = await this.provider!.callFunction<string>(this.contractId, "get_verified_accounts_contract", {})
    return result ?? ""
  }

  async getCitizenRole(): Promise<string> {
    await this.ensureInitialized()
    const result = await this.provider!.callFunction<string>(this.contractId, "get_citizen_role", {})
    return result ?? ""
  }

  // ==================== Write Methods ====================

  async addMember(nearAccountId: string, depositNear: number = 0.1): Promise<string> {
    await this.ensureInitialized()

    try {
      console.log(`[SputnikBridge] Adding member: ${nearAccountId}`)

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "add_member",
            { near_account_id: nearAccountId },
            BigInt("200000000000000"), // 200 TGas for cross-contract calls
            BigInt(depositNear * 1e24), // Convert NEAR to yoctoNEAR
          ),
        ],
      })

      console.log(`[SputnikBridge] Member added, tx: ${result.transaction.hash}`)
      return result.transaction.hash
    } catch (error) {
      console.error("[SputnikBridge] Error adding member:", error)
      this.handleContractError(error)
      throw error
    }
  }

  async createProposal(description: string, depositNear: number = 0.1): Promise<number> {
    await this.ensureInitialized()

    try {
      console.log(`[SputnikBridge] Creating proposal...`)

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "create_proposal",
            { description },
            BigInt("100000000000000"), // 100 TGas
            BigInt(depositNear * 1e24), // Convert NEAR to yoctoNEAR
          ),
        ],
      })

      // Parse proposal ID from return value
      // The callback returns the proposal ID as u64
      const status = result.status as { SuccessValue?: string }
      if (status?.SuccessValue) {
        const decoded = Buffer.from(status.SuccessValue, "base64").toString()
        const proposalId = parseInt(decoded, 10)
        console.log(`[SputnikBridge] Proposal created with ID: ${proposalId}`)
        return proposalId
      }

      console.log(`[SputnikBridge] Proposal created, tx: ${result.transaction.hash}`)
      return -1 // Could not parse proposal ID
    } catch (error) {
      console.error("[SputnikBridge] Error creating proposal:", error)
      this.handleContractError(error)
      throw error
    }
  }

  async updateBackendWallet(newBackendWallet: string): Promise<void> {
    await this.ensureInitialized()

    try {
      await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "update_backend_wallet",
            { new_backend_wallet: newBackendWallet },
            BigInt("30000000000000"), // 30 TGas
            BigInt("1"), // 1 yoctoNEAR
          ),
        ],
      })

      console.log(`[SputnikBridge] Backend wallet updated to: ${newBackendWallet}`)
    } catch (error) {
      console.error("[SputnikBridge] Error updating backend wallet:", error)
      this.handleContractError(error)
      throw error
    }
  }

  async updateCitizenRole(newRole: string): Promise<void> {
    await this.ensureInitialized()

    try {
      await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "update_citizen_role",
            { new_role: newRole },
            BigInt("30000000000000"), // 30 TGas
            BigInt("1"), // 1 yoctoNEAR
          ),
        ],
      })

      console.log(`[SputnikBridge] Citizen role updated to: ${newRole}`)
    } catch (error) {
      console.error("[SputnikBridge] Error updating citizen role:", error)
      this.handleContractError(error)
      throw error
    }
  }

  // ==================== Helpers ====================

  private handleContractError(error: unknown): void {
    if (error instanceof Error && error.message.includes("Smart contract panicked")) {
      const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
      if (panicMatch) {
        throw new Error(panicMatch[1])
      }
    }
  }
}

// ============================================================================
// Singleton Instance (Lazy Initialization)
// ============================================================================

let bridgeInstance: IBridgeContract | null = null

function createBridgeContract(): IBridgeContract {
  const { bridgeContractId, backendAccountId, backendPrivateKey, rpcUrl } = NEAR_CONFIG

  if (!bridgeContractId || !backendAccountId || !backendPrivateKey) {
    throw new Error(
      "Missing required NEAR configuration for bridge contract. Please set:\n" +
        "- NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT (bridge contract address)\n" +
        "- NEAR_ACCOUNT_ID (backend wallet account)\n" +
        "- NEAR_PRIVATE_KEY (backend wallet private key)",
    )
  }

  console.log("[SputnikBridge] Using bridge contract")
  console.log(`[SputnikBridge] Contract: ${bridgeContractId}`)

  return new SputnikBridgeContract(backendAccountId, backendPrivateKey, bridgeContractId, rpcUrl)
}

// Lazy singleton - only initialize when first accessed
export const bridgeContract: IBridgeContract = new Proxy({} as IBridgeContract, {
  get(target, prop) {
    if (!bridgeInstance) {
      bridgeInstance = createBridgeContract()
    }
    return bridgeInstance[prop as keyof IBridgeContract]
  },
})
