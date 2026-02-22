/**
 * Governance Contract RPC Client (Server-only, Read-only)
 *
 * View-only reader for the governance contract.
 * Much simpler than verification client — no Account/Signer needed, just a Provider.
 * All writes happen via user's wallet on the client side.
 */
import "server-only"

import type { Provider } from "@near-js/providers"
import {
  contractProposalViewSchema,
  contractVoteViewSchema,
  contractConfigSchema,
  type ContractProposalView,
  type ContractVoteView,
  type ContractConfig,
  type ProposalView,
  type VoteView,
  type GovernanceConfig,
} from "../../schemas/governance-contract"
import type { Pagination } from "../../schemas/core"
import type { IGovernanceReader, PaginatedProposals } from "./governance-contract"
import { NEAR_CONFIG } from "../../config"
import { getRpcProvider } from "../../providers/rpc-provider"

class GovernanceRpcReader implements IGovernanceReader {
  private provider: Provider
  private contractId: string

  constructor(contractId: string) {
    this.contractId = contractId
    this.provider = getRpcProvider()
  }

  async getProposal(proposalId: number): Promise<ProposalView | null> {
    try {
      const result = await this.provider.callFunction<ContractProposalView>(this.contractId, "get_proposal", {
        proposal_id: proposalId,
      })
      if (!result) return null
      const parsed = contractProposalViewSchema.safeParse(result)
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  async listProposals(fromIndex: number, limit: number): Promise<ProposalView[]> {
    try {
      const result = await this.provider.callFunction<ContractProposalView[]>(this.contractId, "list_proposals", {
        from_index: fromIndex,
        limit: Math.min(limit, 100),
      })
      if (!result) return []
      return result
        .map((item) => contractProposalViewSchema.safeParse(item))
        .filter((r): r is { success: true; data: ProposalView } => r.success)
        .map((r) => r.data)
    } catch {
      return []
    }
  }

  async getProposalCount(): Promise<number> {
    try {
      const result = await this.provider.callFunction<number>(this.contractId, "get_proposal_count", {})
      return result ?? 0
    } catch {
      return 0
    }
  }

  async listProposalsNewestFirst(pagination?: Pagination): Promise<PaginatedProposals> {
    const page = pagination?.page ?? 0
    const pageSize = pagination?.pageSize ?? 20

    const total = await this.getProposalCount()
    if (total === 0) return { proposals: [], total }

    const safePage = Math.max(0, page)
    const remaining = Math.max(total - safePage * pageSize, 0)
    if (remaining === 0) return { proposals: [], total }

    const limit = Math.min(pageSize, remaining, 100)
    const fromIndex = Math.max(total - (safePage + 1) * pageSize, 0)

    const proposals = await this.listProposals(fromIndex, limit)
    return { proposals: proposals.reverse(), total }
  }

  async getVote(proposalId: number, accountId: string): Promise<VoteView | null> {
    try {
      const result = await this.provider.callFunction<ContractVoteView>(this.contractId, "get_vote", {
        proposal_id: proposalId,
        account_id: accountId,
      })
      if (!result) return null
      const parsed = contractVoteViewSchema.safeParse(result)
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  async hasVoted(proposalId: number, accountId: string): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "has_voted", {
        proposal_id: proposalId,
        account_id: accountId,
      })
      return result ?? false
    } catch {
      return false
    }
  }

  async listVotes(proposalId: number, fromIndex: number, limit: number): Promise<VoteView[]> {
    try {
      const result = await this.provider.callFunction<ContractVoteView[]>(this.contractId, "list_votes", {
        proposal_id: proposalId,
        from_index: fromIndex,
        limit: Math.min(limit, 100),
      })
      if (!result) return []
      return result
        .map((item) => contractVoteViewSchema.safeParse(item))
        .filter((r): r is { success: true; data: VoteView } => r.success)
        .map((r) => r.data)
    } catch {
      return []
    }
  }

  async isAdmin(accountId: string): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "is_admin", {
        account_id: accountId,
      })
      return result ?? false
    } catch {
      return false
    }
  }

  async listAdmins(fromIndex: number, limit: number): Promise<string[]> {
    try {
      const result = await this.provider.callFunction<string[]>(this.contractId, "list_admins", {
        from_index: fromIndex,
        limit: Math.min(limit, 100),
      })
      return result ?? []
    } catch {
      return []
    }
  }

  async isBlocklisted(accountId: string): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "is_blocklisted", {
        account_id: accountId,
      })
      return result ?? false
    } catch {
      return false
    }
  }

  async listBlocklist(fromIndex: number, limit: number): Promise<string[]> {
    try {
      const result = await this.provider.callFunction<string[]>(this.contractId, "list_blocklist", {
        from_index: fromIndex,
        limit: Math.min(limit, 100),
      })
      return result ?? []
    } catch {
      return []
    }
  }

  async isBlocklistLocked(): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "is_blocklist_locked", {})
      return result ?? false
    } catch {
      return false
    }
  }

  async getConfig(): Promise<GovernanceConfig> {
    const result = await this.provider.callFunction<ContractConfig>(this.contractId, "get_config", {})
    return contractConfigSchema.parse(result)
  }

  async isVoteFree(): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "is_vote_free", {})
      return result ?? false
    } catch {
      return false
    }
  }

  async getPendingVotesCount(proposalId: number): Promise<number> {
    try {
      const result = await this.provider.callFunction<number>(this.contractId, "get_pending_votes_count", {
        proposal_id: proposalId,
      })
      return result ?? 0
    } catch {
      return 0
    }
  }
}

// ============================================================================
// Singleton Instance (Lazy Initialization)
// ============================================================================

let instance: IGovernanceReader | null = null

function createGovernanceReader(): GovernanceRpcReader {
  const contractId = NEAR_CONFIG.governanceContractId
  if (!contractId) {
    throw new Error("Governance contract not configured (NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT)")
  }
  return new GovernanceRpcReader(contractId)
}

export const governanceReader: IGovernanceReader = new Proxy({} as IGovernanceReader, {
  get(_target, prop) {
    if (!instance) {
      instance = createGovernanceReader()
    }
    return instance[prop as keyof IGovernanceReader]
  },
})
