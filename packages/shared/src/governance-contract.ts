/**
 * NEAR governance contract database implementation
 *
 * Provides database abstraction layer for the governance smart contract.
 * Follows the same pattern as verification-contract.ts for consistency.
 */
import { Account } from "@near-js/accounts"
import type { Provider } from "@near-js/providers"
import type { Signer } from "@near-js/signers"
import { KeyPair } from "@near-js/crypto"
import { JsonRpcProvider } from "@near-js/providers"
import { KeyPairSigner } from "@near-js/signers"
import { actionCreators } from "@near-js/transactions"
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

export type { IGovernanceDatabase, Proposal, Vote, VoteCounts, ProposalStatus }

// Contract format for vote (matches Rust enum)
type ContractVote = "Yes" | "No"

// Contract format for VoteCounts (snake_case)
interface ContractVoteCounts {
  yes_votes: number
  no_votes: number
  total_votes: number
}

export class NearGovernanceContract implements IGovernanceDatabase {
  private account: Account | null = null
  private provider: JsonRpcProvider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(
    private backendAccountId: string,
    private backendPrivateKey: string,
    contractId: string,
    private networkId: string,
    private rpcUrl: string,
  ) {
    this.contractId = contractId
    this.initialized = this.init()
  }

  private async init() {
    try {
      const keyPair = KeyPair.fromString(this.backendPrivateKey as `ed25519:${string}`)
      const signer = new KeyPairSigner(keyPair)

      this.provider = new JsonRpcProvider({ url: this.rpcUrl })

      this.account = new Account(
        this.backendAccountId,
        this.provider as unknown as Provider,
        signer as unknown as Signer,
      )

      console.log(`[GovernanceContract] Initialized with account: ${this.backendAccountId}`)
      console.log(`[GovernanceContract] Contract ID: ${this.contractId}`)
    } catch (error) {
      console.error("[GovernanceContract] Initialization error:", error)
      throw error
    }
  }

  private async ensureInitialized() {
    await this.initialized
    if (!this.account) {
      throw new Error("NEAR account not initialized")
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

  // ==================== WRITE METHODS ====================

  async createProposal(title: string, description: string, discourseUrl?: string): Promise<number> {
    await this.ensureInitialized()

    try {
      console.log("[GovernanceContract] Calling create_proposal on contract...")

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "create_proposal",
            {
              title,
              description,
              discourse_url: discourseUrl || null,
            },
            BigInt("30000000000000"), // 30 TGas
            BigInt("1"), // 1 yoctoNEAR deposit (required for cross-contract call)
          ),
        ],
      })

      // Extract proposal ID from result
      // The contract returns the proposal ID as a JSON number
      const status = result.status as { SuccessValue?: string }
      const proposalId = status.SuccessValue
        ? JSON.parse(Buffer.from(status.SuccessValue, "base64").toString())
        : null

      if (proposalId === null) {
        throw new Error("Failed to get proposal ID from contract response")
      }

      console.log("[GovernanceContract] Proposal created:", {
        proposalId,
        transactionHash: result.transaction.hash,
      })

      return proposalId
    } catch (error) {
      console.error("[GovernanceContract] Error creating proposal:", error)

      // Parse contract panic message if available
      if (error instanceof Error && error.message.includes("Smart contract panicked")) {
        const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
        if (panicMatch) {
          throw new Error(panicMatch[1])
        }
      }

      throw error
    }
  }

  async vote(proposalId: number, vote: Vote): Promise<void> {
    await this.ensureInitialized()

    try {
      console.log("[GovernanceContract] Calling vote on contract...")

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "vote",
            {
              proposal_id: proposalId,
              vote,
            },
            BigInt("30000000000000"), // 30 TGas
            BigInt("1"), // 1 yoctoNEAR deposit (required for cross-contract call)
          ),
        ],
      })

      console.log("[GovernanceContract] Vote cast:", {
        proposalId,
        vote,
        transactionHash: result.transaction.hash,
      })
    } catch (error) {
      console.error("[GovernanceContract] Error voting:", error)

      // Parse contract panic message if available
      if (error instanceof Error && error.message.includes("Smart contract panicked")) {
        const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
        if (panicMatch) {
          throw new Error(panicMatch[1])
        }
      }

      throw error
    }
  }

  async finalizeProposal(proposalId: number): Promise<void> {
    await this.ensureInitialized()

    try {
      console.log("[GovernanceContract] Calling finalize_proposal on contract...")

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "finalize_proposal",
            {
              proposal_id: proposalId,
            },
            BigInt("30000000000000"), // 30 TGas
            BigInt("0"), // No deposit required
          ),
        ],
      })

      console.log("[GovernanceContract] Proposal finalized:", {
        proposalId,
        transactionHash: result.transaction.hash,
      })
    } catch (error) {
      console.error("[GovernanceContract] Error finalizing proposal:", error)

      // Parse contract panic message if available
      if (error instanceof Error && error.message.includes("Smart contract panicked")) {
        const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
        if (panicMatch) {
          throw new Error(panicMatch[1])
        }
      }

      throw error
    }
  }

  async cancelProposal(proposalId: number): Promise<void> {
    await this.ensureInitialized()

    try {
      console.log("[GovernanceContract] Calling cancel_proposal on contract...")

      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "cancel_proposal",
            {
              proposal_id: proposalId,
            },
            BigInt("10000000000000"), // 10 TGas
            BigInt("0"), // No deposit required
          ),
        ],
      })

      console.log("[GovernanceContract] Proposal cancelled:", {
        proposalId,
        transactionHash: result.transaction.hash,
      })
    } catch (error) {
      console.error("[GovernanceContract] Error cancelling proposal:", error)

      // Parse contract panic message if available
      if (error instanceof Error && error.message.includes("Smart contract panicked")) {
        const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
        if (panicMatch) {
          throw new Error(panicMatch[1])
        }
      }

      throw error
    }
  }
}

// ============================================================================
// Singleton Database Instance (Lazy Initialization)
// ============================================================================

let dbInstance: IGovernanceDatabase | null = null

function createGovernanceContract(): IGovernanceDatabase {
  const contractId = process.env.NEAR_GOVERNANCE_CONTRACT_ID
  const backendAccountId = process.env.NEAR_ACCOUNT_ID
  const backendPrivateKey = process.env.NEAR_PRIVATE_KEY
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org"

  if (!contractId || !backendAccountId || !backendPrivateKey) {
    throw new Error(
      "Missing required NEAR governance configuration. Please set:\n" +
        "- NEAR_GOVERNANCE_CONTRACT_ID (governance contract address)\n" +
        "- NEAR_ACCOUNT_ID (backend wallet account)\n" +
        "- NEAR_PRIVATE_KEY (backend wallet private key)\n" +
        "See DEVELOPER.md for setup instructions.",
    )
  }

  console.log("[GovernanceContract] Using NEAR governance smart contract")
  console.log(`[GovernanceContract] Contract: ${contractId}`)
  console.log(`[GovernanceContract] Network: ${networkId}`)

  return new NearGovernanceContract(backendAccountId, backendPrivateKey, contractId, networkId, rpcUrl)
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
