/**
 * NEAR governance contract read-only database implementation
 *
 * Provides database abstraction layer for reading from the governance smart contract.
 * Write operations (createProposal, vote, etc.) are handled client-side via useGovernance hook.
 */
import { JsonRpcProvider } from "@near-js/providers"
import {
  contractProposalSchema,
  contractVoteCountsSchema,
  type ContractProposal,
  type IGovernanceDatabase,
  type Proposal,
  type ProposalStatus,
  type Vote,
  type VoteCounts,
} from "./types"
import { NEAR_CONFIG } from "./config"

export type { IGovernanceDatabase, Proposal, Vote, VoteCounts, ProposalStatus }

// Contract format for vote (matches Rust enum)
type ContractVote = "Yes" | "No"

// Contract format for VoteCounts (snake_case)
interface ContractVoteCounts {
  yes_votes: number
  no_votes: number
  total_votes: number
}

/**
 * Read-only governance contract client.
 * Write operations should be performed via useGovernance hook (client-side wallet signing).
 */
export class NearGovernanceContract implements IGovernanceDatabase {
  private provider: JsonRpcProvider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(contractId: string, rpcUrl: string) {
    this.contractId = contractId
    this.initialized = this.init(rpcUrl)
  }

  private async init(rpcUrl: string) {
    try {
      this.provider = new JsonRpcProvider({ url: rpcUrl })
      console.log(`[GovernanceContract] Initialized read-only client`)
      console.log(`[GovernanceContract] Contract ID: ${this.contractId}`)
    } catch (error) {
      console.error("[GovernanceContract] Initialization error:", error)
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

  async getProposal(proposalId: number): Promise<Proposal | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractProposal>(this.contractId, "get_proposal", {
        proposal_id: proposalId,
      })

      if (!result) {
        return null
      }

      // Validate and transform contract response using Zod schema
      return contractProposalSchema.parse(result)
    } catch (error) {
      console.error("[GovernanceContract] Error getting proposal:", error)
      return null
    }
  }

  async getProposals(from: number, limit: number, status?: ProposalStatus): Promise<Proposal[]> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractProposal[]>(this.contractId, "get_proposals", {
        from_index: from,
        limit,
        status: status || null,
      })

      if (!result) {
        return []
      }

      // Validate and transform each contract response using Zod schema
      return result.map((item) => contractProposalSchema.parse(item))
    } catch (error) {
      console.error("[GovernanceContract] Error getting proposals:", error)
      return []
    }
  }

  async getVote(proposalId: number, accountId: string): Promise<Vote | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractVote>(this.contractId, "get_vote", {
        proposal_id: proposalId,
        account_id: accountId,
      })

      return result || null
    } catch (error) {
      console.error("[GovernanceContract] Error getting vote:", error)
      return null
    }
  }

  async hasVoted(proposalId: number, accountId: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<boolean>(this.contractId, "has_voted", {
        proposal_id: proposalId,
        account_id: accountId,
      })

      return result ?? false
    } catch (error) {
      console.error("[GovernanceContract] Error checking has voted:", error)
      return false
    }
  }

  async getVoteCounts(proposalId: number): Promise<VoteCounts> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractVoteCounts>(this.contractId, "get_vote_counts", {
        proposal_id: proposalId,
      })

      if (!result) {
        return { yesVotes: 0, noVotes: 0, totalVotes: 0 }
      }

      // Validate and transform contract response using Zod schema
      return contractVoteCountsSchema.parse(result)
    } catch (error) {
      console.error("[GovernanceContract] Error getting vote counts:", error)
      return { yesVotes: 0, noVotes: 0, totalVotes: 0 }
    }
  }

  async getProposalCount(): Promise<number> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<number>(this.contractId, "get_proposal_count", {})

      return result ?? 0
    } catch (error) {
      console.error("[GovernanceContract] Error getting proposal count:", error)
      return 0
    }
  }
}

// ============================================================================
// Singleton Database Instance (Lazy Initialization)
// ============================================================================

let dbInstance: IGovernanceDatabase | null = null

function createGovernanceContract(): IGovernanceDatabase {
  const { governanceContractId, rpcUrl, networkId } = NEAR_CONFIG

  if (!governanceContractId) {
    throw new Error(
      "Missing required NEAR governance configuration. Please set:\n" +
        "- NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT (governance contract address)\n" +
        "See DEVELOPER.md for setup instructions.",
    )
  }

  console.log("[GovernanceContract] Using NEAR governance smart contract (read-only)")
  console.log(`[GovernanceContract] Contract: ${governanceContractId}`)
  console.log(`[GovernanceContract] Network: ${networkId}`)

  return new NearGovernanceContract(governanceContractId, rpcUrl)
}

// Lazy singleton - only initialize when first accessed (not during build)
export const governanceDb: IGovernanceDatabase = new Proxy({} as IGovernanceDatabase, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = createGovernanceContract()
    }
    return dbInstance[prop as keyof IGovernanceDatabase]
  },
})
