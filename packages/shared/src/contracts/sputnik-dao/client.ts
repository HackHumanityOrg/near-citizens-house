/**
 * SputnikDAO v2 Contract Read-Only Client
 *
 * Provides database abstraction layer for reading from SputnikDAO v2 contracts.
 * Write operations (voting) are handled client-side via useSputnikDao hook.
 */
import { JsonRpcProvider } from "@near-js/providers"
import {
  sputnikProposalSchema,
  transformedPolicySchema,
  type ContractSputnikProposal,
  type ISputnikDaoContract,
  type SputnikProposal,
  type TransformedPolicy,
  type SputnikPolicy,
} from "./types"
import { NEAR_CONFIG } from "../../config"

export type { ISputnikDaoContract, SputnikProposal, TransformedPolicy }

/**
 * Read-only SputnikDAO v2 contract client.
 * Write operations should be performed via useSputnikDao hook (client-side wallet signing).
 */
export class SputnikDaoContract implements ISputnikDaoContract {
  private provider: JsonRpcProvider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(contractId: string, rpcUrl: string) {
    this.contractId = contractId
    this.initialized = this.init(rpcUrl)
  }

  private async init(rpcUrl: string) {
    try {
      this.provider = new JsonRpcProvider({
        url: rpcUrl,
        headers: NEAR_CONFIG.rpcHeaders,
      })
      console.log(`[SputnikDaoContract] Initialized read-only client`)
      console.log(`[SputnikDaoContract] Contract ID: ${this.contractId}`)
      console.log(`[SputnikDaoContract] RPC URL: ${rpcUrl}`)
    } catch (error) {
      console.error("[SputnikDaoContract] Initialization error:", error)
      throw error
    }
  }

  private async ensureInitialized() {
    await this.initialized
    if (!this.provider) {
      throw new Error("NEAR provider not initialized")
    }
  }

  // ==================== READ METHODS ====================

  async getProposal(id: number): Promise<SputnikProposal | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractSputnikProposal>(this.contractId, "get_proposal", { id })

      if (!result) {
        return null
      }

      // Validate and transform contract response using Zod schema
      return sputnikProposalSchema.parse(result)
    } catch (error) {
      console.error("[SputnikDaoContract] Error getting proposal:", error)
      return null
    }
  }

  async getProposals(fromIndex: number, limit: number): Promise<SputnikProposal[]> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractSputnikProposal[]>(this.contractId, "get_proposals", {
        from_index: fromIndex,
        limit,
      })

      if (!result) {
        return []
      }

      // Validate and transform each contract response using Zod schema
      return result.map((item) => sputnikProposalSchema.parse(item))
    } catch (error) {
      console.error("[SputnikDaoContract] Error getting proposals:", error)
      return []
    }
  }

  async getLastProposalId(): Promise<number> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<number>(this.contractId, "get_last_proposal_id", {})

      return result ?? 0
    } catch (error) {
      console.error("[SputnikDaoContract] Error getting last proposal ID:", error)
      return 0
    }
  }

  async getPolicy(): Promise<TransformedPolicy> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<SputnikPolicy>(this.contractId, "get_policy", {})

      if (!result) {
        throw new Error("Failed to get DAO policy")
      }

      // Validate and transform policy using Zod schema
      return transformedPolicySchema.parse(result)
    } catch (error) {
      console.error("[SputnikDaoContract] Error getting policy:", error)
      // Return a default policy structure if call fails
      return {
        roles: [],
        defaultVotePolicy: {
          weightKind: "RoleWeight",
          quorum: "0",
          threshold: [1, 2], // 50%
        },
        proposalBond: "100000000000000000000000", // 0.1 NEAR
        proposalPeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        bountyBond: "100000000000000000000000",
        bountyForgivenessPeriodMs: 24 * 60 * 60 * 1000, // 1 day
      }
    }
  }
}

// ============================================================================
// Singleton Database Instance (Lazy Initialization)
// ============================================================================

let dbInstance: ISputnikDaoContract | null = null

function createSputnikDaoContract(): ISputnikDaoContract {
  const { sputnikDaoContractId, rpcUrl, networkId } = NEAR_CONFIG

  if (!sputnikDaoContractId) {
    throw new Error(
      "Missing required NEAR SputnikDAO configuration. Please set:\n" +
        "- NEXT_PUBLIC_SPUTNIK_DAO_CONTRACT (SputnikDAO contract address)\n" +
        "See DEVELOPER.md for setup instructions.",
    )
  }

  console.log("[SputnikDaoContract] Using SputnikDAO v2 smart contract (read-only)")
  console.log(`[SputnikDaoContract] Contract: ${sputnikDaoContractId}`)
  console.log(`[SputnikDaoContract] Network: ${networkId}`)

  return new SputnikDaoContract(sputnikDaoContractId, rpcUrl)
}

// Lazy singleton - only initialize when first accessed (not during build)
export const sputnikDaoDb: ISputnikDaoContract = new Proxy({} as ISputnikDaoContract, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = createSputnikDaoContract()
    }
    return dbInstance[prop as keyof ISputnikDaoContract]
  },
})
